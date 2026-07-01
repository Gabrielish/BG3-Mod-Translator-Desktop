import type { AiProviderId } from '../../../preload/api-types'

export type { AiProviderId }

export interface AiChatRequest {
  model: string
  prompt: string
  signal?: AbortSignal
}

// One interface, many senders. Every provider receives the same rendered prompt;
// only the HTTP shaping differs (see openai-compatible / anthropic adapters).
export interface AiProvider {
  chat(req: AiChatRequest): Promise<string>
}
