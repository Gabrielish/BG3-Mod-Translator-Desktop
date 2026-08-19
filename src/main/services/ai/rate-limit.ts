import { getProviderRateLimit, type ProviderRateLimit } from './provider-limits'

// Proactive + reactive rate limiting for AI providers.
//
// 1. A per-provider gate paces requests to the published free/low-tier RPM and
//    concurrency so we don't burst into 429s (Gemini free is the usual culprit).
// 2. On 429/503/529 we honor Retry-After / retryDelay, capped, with a hard retry
//    budget. Daily/billing quota is not retried.
// 3. Wait events are forwarded so the UI can tell the user it's slower than
//    planned and they can cancel.

export const RATE_LIMITED_USER_ERROR = '[user-error:translation.aiRateLimited]'
export const QUOTA_EXHAUSTED_USER_ERROR = '[user-error:translation.aiQuotaExhausted]'

export type RateLimitWaitReason = 'pace' | 'retry' | 'cooldown'

export interface RateLimitWaitInfo {
  providerId: string
  delayMs: number
  attempt: number
  maxAttempts: number
  reason: RateLimitWaitReason
}

export type RateLimitWaitHandler = (info: RateLimitWaitInfo) => void

const RETRYABLE_STATUS = new Set([429, 503, 529])
const LEARNED_RPM_CAP = 500
const RPM_WINDOW_MS = 60_000

const HARD_QUOTA_RE =
  /insufficient_quota|exceeded your current quota|quota.?exceeded|billing|daily.?limit|per day|requests per day|\brpd\b|generaterequestsperday|spend.?limit|credit.?limit|usage.?limit.?reached/i

let waitHandler: RateLimitWaitHandler | null = null

export function setRateLimitWaitHandler(handler: RateLimitWaitHandler | null): void {
  waitHandler = handler
}

export function isAiLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes(RATE_LIMITED_USER_ERROR) || message.includes(QUOTA_EXHAUSTED_USER_ERROR)
}

export function parseRetryDelayMs(response: Response, body: string): number | null {
  const header = response.headers.get('retry-after') ?? response.headers.get('retry-after-ms')

  if (header) {
    const fromHeader = parseRetryAfterValue(header, response.headers.has('retry-after-ms'))
    if (fromHeader !== null) return fromHeader
  }

  const retryDelayJson = body.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i)
  if (retryDelayJson) return secondsToMs(Number.parseFloat(retryDelayJson[1]))

  const retryDelaySeconds = body.match(/"retryDelay"\s*:\s*\{\s*"seconds"\s*:\s*(\d+)/i)
  if (retryDelaySeconds) return secondsToMs(Number.parseInt(retryDelaySeconds[1], 10))

  const compact = body.match(/retry in ([\d.]+)\s*s/i)
  if (compact) return secondsToMs(Number.parseFloat(compact[1]))

  const after = body.match(/retry after ([\d.]+)\s*s/i)
  if (after) return secondsToMs(Number.parseFloat(after[1]))

  const human = body.match(/try again in ([^.]+?)(?:\.|$)/i)
  if (human) {
    const parsed = parseHumanDurationMs(human[1])
    if (parsed !== null) return parsed
  }

  return null
}

export function isHardQuota(
  body: string,
  retryMs: number | null,
  maxRetryDelayMs: number
): boolean {
  if (retryMs !== null && retryMs > maxRetryDelayMs) return true
  return HARD_QUOTA_RE.test(body)
}

export function fallbackDelayMs(attempt: number): number {
  const base = 2000 * 2 ** Math.max(0, attempt)
  const jitter = 0.8 + Math.random() * 0.4
  return Math.round(base * jitter)
}

export interface RateLimitedRequestParams {
  providerId: string
  label: string
  signal?: AbortSignal
  model?: string
  limits?: ProviderRateLimit
  doRequest: () => Promise<Response>
}

export async function requestWithRateLimit(params: RateLimitedRequestParams): Promise<Response> {
  const { providerId, label, signal, model, doRequest } = params
  const limit = params.limits ?? {
    ...getProviderRateLimit(providerId, model),
    ...runtimeOverrides.get(providerId)
  }
  const gate = getGate(providerId, limit)
  let lastBody = ''

  for (let attempt = 0; attempt <= limit.maxRetries; attempt++) {
    throwIfAborted(signal)
    await gate.acquire(signal, (delayMs, reason) => {
      notifyWait({
        providerId,
        delayMs,
        attempt,
        maxAttempts: limit.maxRetries,
        reason
      })
    })

    let response: Response
    try {
      response = await doRequest()
    } finally {
      gate.release()
    }

    if (!RETRYABLE_STATUS.has(response.status)) {
      gate.noteSuccess(response.headers)
      return response
    }

    lastBody = await response.text().catch(() => '')
    const parsedDelay = parseRetryDelayMs(response, lastBody)

    if (isHardQuota(lastBody, parsedDelay, limit.maxRetryDelayMs)) {
      throw new Error(
        `${QUOTA_EXHAUSTED_USER_ERROR} ${label} API error ${response.status}: ${lastBody.slice(0, 2000)}`
      )
    }

    if (attempt === limit.maxRetries) break

    const delay = Math.min(parsedDelay ?? fallbackDelayMs(attempt), limit.maxRetryDelayMs)
    gate.noteRetryAfter(delay)
    notifyWait({
      providerId,
      delayMs: delay,
      attempt: attempt + 1,
      maxAttempts: limit.maxRetries,
      reason: 'retry'
    })
  }

  throw new Error(`${RATE_LIMITED_USER_ERROR} ${label} API error 429: ${lastBody.slice(0, 2000)}`)
}

export function resetRateLimitState(): void {
  gates.clear()
  runtimeOverrides.clear()
  waitHandler = null
}

const runtimeOverrides = new Map<string, Partial<ProviderRateLimit>>()

export function setRuntimeProviderLimits(
  providerId: string,
  override: Partial<ProviderRateLimit> | null
): void {
  if (override) runtimeOverrides.set(providerId, override)
  else runtimeOverrides.delete(providerId)
}

class ProviderGate {
  private inflight = 0
  private window: number[] = []
  private lastStartedAt = 0
  private cooldownUntil = 0
  private adaptedRpm: number

  constructor(private limit: ProviderRateLimit) {
    this.adaptedRpm = limit.rpm
  }

  updateLimit(limit: ProviderRateLimit): void {
    this.limit = limit
    if (limit.rpm > this.adaptedRpm) this.adaptedRpm = limit.rpm
  }

  async acquire(
    signal: AbortSignal | undefined,
    onWait: (delayMs: number, reason: RateLimitWaitReason) => void
  ): Promise<void> {
    while (true) {
      throwIfAborted(signal)
      const now = Date.now()
      this.prune(now)

      const cooldown = this.cooldownUntil - now
      const minInterval = Math.ceil(RPM_WINDOW_MS / Math.max(1, this.adaptedRpm))
      const intervalWait = this.lastStartedAt === 0 ? 0 : this.lastStartedAt + minInterval - now
      const windowWait =
        this.window.length >= this.adaptedRpm ? this.window[0] + RPM_WINDOW_MS - now : 0
      const concurrentWait = this.inflight >= this.limit.maxConcurrent ? 25 : 0
      const wait = Math.max(0, cooldown, intervalWait, windowWait, concurrentWait)

      if (wait === 0) {
        const started = Date.now()
        this.inflight++
        this.lastStartedAt = started
        this.window.push(started)
        return
      }

      const reason: RateLimitWaitReason = cooldown > 0 ? 'cooldown' : 'pace'
      if (wait >= 1000) onWait(wait, reason)
      await sleep(wait, signal)
    }
  }

  release(): void {
    this.inflight = Math.max(0, this.inflight - 1)
  }

  noteSuccess(headers: Headers): void {
    const learned = readHeaderRpm(headers)
    if (learned === null) return
    this.adaptedRpm = Math.max(1, Math.min(learned, LEARNED_RPM_CAP))
  }

  noteRetryAfter(delayMs: number): void {
    const until = Date.now() + Math.max(0, delayMs)
    if (until > this.cooldownUntil) this.cooldownUntil = until
    this.adaptedRpm = Math.max(1, Math.floor(this.adaptedRpm * 0.7))
  }

  private prune(now: number): void {
    const cutoff = now - RPM_WINDOW_MS
    if (this.window.length === 0 || this.window[0] >= cutoff) return
    this.window = this.window.filter((ts) => ts >= cutoff)
  }
}

const gates = new Map<string, ProviderGate>()

function getGate(providerId: string, limit: ProviderRateLimit): ProviderGate {
  const existing = gates.get(providerId)
  if (existing) {
    existing.updateLimit(limit)
    return existing
  }
  const created = new ProviderGate(limit)
  gates.set(providerId, created)
  return created
}

function readHeaderRpm(headers: Headers): number | null {
  const raw =
    headers.get('x-ratelimit-limit-requests') ?? headers.get('anthropic-ratelimit-requests-limit')
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

function notifyWait(info: RateLimitWaitInfo): void {
  waitHandler?.(info)
}

function parseRetryAfterValue(header: string, isMilliseconds: boolean): number | null {
  const numeric = Number(header)
  if (Number.isFinite(numeric) && numeric >= 0) {
    return isMilliseconds ? Math.ceil(numeric) : secondsToMs(numeric)
  }

  const asDate = Date.parse(header)
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now())

  return parseHumanDurationMs(header)
}

function parseHumanDurationMs(raw: string): number | null {
  const text = raw.trim().toLowerCase()
  if (!text) return null

  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0)
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*m(?!s)/)?.[1] ?? 0)
  const seconds = Number(text.match(/(\d+(?:\.\d+)?)\s*s/)?.[1] ?? 0)
  if (hours || minutes || seconds) {
    return Math.ceil(((hours * 60 + minutes) * 60 + seconds) * 1000)
  }

  const asNumber = Number(text)
  if (Number.isFinite(asNumber) && asNumber >= 0) return secondsToMs(asNumber)
  return null
}

function secondsToMs(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null
  return Math.ceil(seconds * 1000)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortError = () => signal?.reason ?? new Error('Translation cancelled')
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new Error('Translation cancelled')
  }
}
