import { eq } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { DEFAULT_PROMPT } from '../../services/ai/prompt-builder'
import { promptSlot } from '../schema'

type AppDb = ReturnType<typeof drizzle>

const DEFAULT_SLOT_NAME = 'Padrão · BG3'

// Seed the locked default prompt slot once. It is the always-available fallback; editing it
// in the UI forks a new slot rather than overwriting this row.
export function seedPromptSlots(db: AppDb): void {
  const existing = db.select().from(promptSlot).where(eq(promptSlot.isDefault, 1)).get()
  if (existing) return
  db.insert(promptSlot)
    .values({ name: DEFAULT_SLOT_NAME, prompt: DEFAULT_PROMPT, isDefault: 1 })
    .run()
}
