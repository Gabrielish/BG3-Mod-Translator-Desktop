import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { AiProviderId } from '@/types'

interface BatchWaitingState {
  until: number
  attempt: number
  maxAttempts: number
  reason: 'pace' | 'retry' | 'cooldown'
}

export interface BatchAiProviderOption {
  id: AiProviderId
  name: string
  hasKey: boolean
}

interface BatchActionBarProps {
  selectedCount: number
  batchCompleted: number
  batchTotal: number
  waiting: BatchWaitingState | null
  onTranslateDeepL: () => void
  onTranslateGoogle: () => void
  onTranslateAI: (providerId: AiProviderId) => void
  aiProviders: BatchAiProviderOption[]
  activeAiProvider: AiProviderId
  onCancelTranslation: () => void
  onClearSelection: () => void
  isTranslating: boolean
}

export function BatchActionBar({
  selectedCount,
  batchCompleted,
  batchTotal,
  waiting,
  onTranslateDeepL,
  onTranslateGoogle,
  onTranslateAI,
  aiProviders,
  activeAiProvider,
  onCancelTranslation,
  onClearSelection,
  isTranslating
}: BatchActionBarProps): React.JSX.Element | null {
  const { t } = useAppTranslation(['translate', 'common', 'ai'])
  const remainingSeconds = useWaitingSeconds(waiting)
  const [selectedAi, setSelectedAi] = useState<AiProviderId>(activeAiProvider)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedAi(activeAiProvider)
  }, [activeAiProvider])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  if (selectedCount === 0 && !isTranslating) return null

  const selectedMeta = aiProviders.find((p) => p.id === selectedAi) ?? aiProviders[0]

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-neutral-700 bg-neutral-900 px-4 py-3">
      <span className="shrink-0 text-sm text-neutral-400">
        {t('batchBar.selectedCount', { ns: 'translate', count: selectedCount })}
      </span>

      {isTranslating ? (
        <>
          <div className="flex min-w-0 flex-col gap-0.5 text-sm text-neutral-400">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {t('batchBar.translating', {
                ns: 'translate',
                completed: batchCompleted,
                total: batchTotal || selectedCount
              })}
            </div>
            {waiting && remainingSeconds > 0 ? (
              <span className="text-amber-300">
                {waiting.reason === 'pace'
                  ? t('batchBar.pacingWait', { ns: 'translate', seconds: remainingSeconds })
                  : t('batchBar.rateLimitedWait', {
                      ns: 'translate',
                      seconds: remainingSeconds,
                      attempt: waiting.attempt,
                      max: waiting.maxAttempts
                    })}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancelTranslation}
            className="cursor-pointer rounded-md border border-red-500/60 px-3 py-1.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/10"
          >
            {t('batchBar.stop', { ns: 'translate' })}
          </button>
        </>
      ) : (
        <>
          <div ref={menuRef} className="relative flex">
            <button
              type="button"
              onClick={() => onTranslateAI(selectedAi)}
              className="flex cursor-pointer items-center gap-1.5 rounded-l-md bg-amber-500/90 px-3 py-1.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500"
            >
              <Sparkles size={14} />
              {t('actions.translateWithAIProvider', {
                ns: 'ai',
                provider: selectedMeta?.name ?? 'AI'
              })}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title={t('batchBar.chooseAiProvider', { ns: 'translate' })}
              className="cursor-pointer rounded-r-md border-l border-amber-700/40 bg-amber-500/90 px-1.5 text-neutral-950 transition-colors hover:bg-amber-500"
            >
              <ChevronDown size={14} />
            </button>
            {menuOpen ? (
              <div className="absolute bottom-full left-0 z-30 mb-1 min-w-full overflow-hidden rounded-md border border-neutral-700 bg-[#131518] shadow-xl">
                {aiProviders.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setSelectedAi(option.id)
                      setMenuOpen(false)
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-xs ${
                      option.id === selectedAi
                        ? 'bg-amber-400/10 text-amber-300'
                        : 'text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    <span>{option.name}</span>
                    {!option.hasKey ? (
                      <span className="text-[10px] text-neutral-500">
                        {t('providers.noKey', { ns: 'ai' })}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onTranslateDeepL}
            className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {t('batchBar.translateWithDeepL', { ns: 'translate' })}
          </button>
          <button
            type="button"
            onClick={onTranslateGoogle}
            className="cursor-pointer rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {t('batchBar.translateWithGoogle', { ns: 'translate' })}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onClearSelection}
        disabled={isTranslating}
        className="ml-auto cursor-pointer text-xs text-neutral-500 transition-colors hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('batchBar.clearSelection', { ns: 'translate' })}
      </button>
    </div>
  )
}

function useWaitingSeconds(waiting: BatchWaitingState | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!waiting) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [waiting])

  if (!waiting) return 0
  return Math.max(0, Math.ceil((waiting.until - now) / 1000))
}
