export interface MergeWorkerInput {
  sourceXmlPath: string
  sourceLang: string
  targetXmlPath: string
  targetLang: string
  modName: string
  dbPath: string
}

export interface MergeResult {
  matched: number
  sourceOnly: number
  targetOnly: number
}

export type MergeProgress =
  | { phase: 'parsing' }
  | { phase: 'loading-map' }
  | { phase: 'classifying' }
  | { phase: 'writing'; processed: number; total: number }
  | { phase: 'done'; result: MergeResult }
  | { phase: 'error'; message: string }

// Task 03 replaces this stub with the real merge pipeline.
export async function runMergeWorker(
  _input: MergeWorkerInput,
  post: (msg: MergeProgress) => void
): Promise<void> {
  post({ phase: 'done', result: { matched: 0, sourceOnly: 0, targetOnly: 0 } })
}
