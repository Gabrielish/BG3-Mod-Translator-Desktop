import type { AiProviderId, AiSimilarityExample } from '../../../preload/api-types'
import { renderPrompt } from './prompt-builder'
import { createAiProvider } from './provider-registry'

export interface AiTranslateParams {
  providerId: AiProviderId
  apiKey: string
  model: string
  template: string
  sourceText: string
  targetText: string
  sourceLangName: string
  targetLangName: string
  examples?: AiSimilarityExample[]
  signal?: AbortSignal
}

// Shared by every AI entry point (single line, grid batch, .pak pipeline): render the
// template with the four variables + reference examples, then hand the finished prompt to
// the provider adapter. The wrapper is the only thing that knows how to talk to each API.
export async function aiTranslate(params: AiTranslateParams): Promise<string> {
  const prompt = renderPrompt({
    template: params.template,
    sourceText: params.sourceText,
    targetText: params.targetText,
    sourceLangName: params.sourceLangName,
    targetLangName: params.targetLangName,
    examples: params.examples
  })

  const provider = createAiProvider(params.providerId, params.apiKey)
  return provider.chat({ model: params.model, prompt, signal: params.signal })
}
