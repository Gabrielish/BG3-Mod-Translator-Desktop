import type { AiSimilarityExample } from '../../../preload/api-types'
import { REQUIRED_PROMPT_VARS } from '../../../preload/api-types'
import type { SimilarEntry } from '../similarity.service'

// Markdown-optimised default prompt. Seeded into the prompt_slot table as the locked
// default; editing it in the UI forks a new slot instead of overwriting it.
export const DEFAULT_PROMPT = `Você é um tradutor especializado em mods de **Baldur's Gate 3**, com domínio do universo de **Dungeons & Dragons** (5e).

## Objetivo
Traduzir de {SOURCE_LANGUAGE} para {TARGET_LANGUAGE} mantendo tom, lore e terminologia oficial.

## Regras
- Use as traduções **oficiais** de D&D — ex.: "Saving Throw" → "Teste de Resistência", "Spell Slot" → "Espaço de Magia", "Ability Check" → "Teste de Habilidade".
- Preserve **exatamente** todas as tags XML e placeholders (\`<LSTag ...>\`, \`{0}\`, \`{1}\`) na mesma posição.
- Mantenha o tom heroico/sombrio do jogo. Não adicione comentários.

## Entrada
- Idioma de origem: {SOURCE_LANGUAGE}
- Texto de origem: {SOURCE_TEXT}
- Tradução atual (se houver): {TARGET_TEXT}

Responda **apenas** com a tradução final em {TARGET_LANGUAGE}.`

// Fixed, non-customisable block appended when similarity examples are included.
const SIMILARITY_HEADING = '## Alguns exemplos de referência'

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
