import type { AiSimilarityExample } from '../../../preload/api-types'
import { REQUIRED_PROMPT_VARS } from '../../../preload/api-types'
import type { SimilarEntry } from '../similarity.service'

// Markdown-optimised default prompt. Seeded into the prompt_slot table as the locked
// default; editing it in the UI forks a new slot instead of overwriting it.
export const DEFAULT_PROMPT = `You are a translator specialized in **Baldur's Gate 3** mods, with deep knowledge of the **Dungeons & Dragons** (5e) universe.

## Goal
Translate from {SOURCE_LANGUAGE} to {TARGET_LANGUAGE}, preserving the tone, lore and official terminology.

## Rules
- Use the **official** D&D translations of the target language — e.g. in Brazilian Portuguese: "Saving Throw" → "Teste de Resistência", "Spell Slot" → "Espaço de Magia", "Ability Check" → "Teste de Habilidade".
- Keep **all** XML tags and placeholders (\`<LSTag ...>\`, \`{0}\`, \`{1}\`) exactly as they are, in the same position.
- Keep the game's heroic/dark tone. Do not add comments or explanations.

## Input
- Source language: {SOURCE_LANGUAGE}
- Source text: {SOURCE_TEXT}
- Current translation (if any): {TARGET_TEXT}

Reply with **only** the final translation in {TARGET_LANGUAGE}.`

// Fixed, non-customisable block appended when similarity examples are included.
const SIMILARITY_HEADING = '## Reference examples'

export interface RenderPromptParams {
  template: string
  sourceText: string
  targetText: string
  sourceLangName: string
  targetLangName: string
  examples?: AiSimilarityExample[]
}

// Substitutes the four required variables and appends the reference-examples block.
export function renderPrompt(params: RenderPromptParams): string {
  const { template, sourceText, targetText, sourceLangName, targetLangName, examples } = params

  const rendered = template
    .replaceAll('{SOURCE_TEXT}', sourceText)
    .replaceAll('{TARGET_TEXT}', targetText)
    .replaceAll('{SOURCE_LANGUAGE}', sourceLangName)
    .replaceAll('{TARGET_LANGUAGE}', targetLangName)

  const block = buildSimilarityBlock(examples ?? [])
  return block ? `${rendered}\n\n${block}` : rendered
}

export function buildSimilarityBlock(examples: AiSimilarityExample[]): string {
  if (examples.length === 0) return ''
  const bullets = examples.map((e) => `- "${e.src}" → "${e.tgt}"`).join('\n')
  return `${SIMILARITY_HEADING}\n${bullets}`
}

export interface SimilarityFilterOptions {
  count: number
  minScore: number
}

// Fuse returns a *distance* (0 = best). The UI works in *similarity* (higher = best) with a
// "ignore below X" threshold, so convert here (similarity = 1 - distance), drop low hits and
// keep the top `count`. Input is already ordered best-first by Fuse.
export function filterExamples(
  context: SimilarEntry[],
  { count, minScore }: SimilarityFilterOptions
): AiSimilarityExample[] {
  return context
    .filter((entry) => 1 - entry.score >= minScore)
    .slice(0, Math.max(0, count))
    .map((entry) => ({ src: entry.original, tgt: entry.translated }))
}

export { REQUIRED_PROMPT_VARS }
