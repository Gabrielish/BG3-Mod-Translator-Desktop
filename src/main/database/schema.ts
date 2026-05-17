import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`)
}

export const language = sqliteTable('language', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  ...timestamps
})

export const mod = sqliteTable('mod', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').unique().notNull(),
  totalStrings: integer('total_strings').default(0),
  lastFilePath: text('last_file_path'),
  ...timestamps
})

export const modMeta = sqliteTable('mod_meta', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  modId: integer('mod_id')
    .notNull()
    .unique()
    .references(() => mod.id, { onDelete: 'cascade' }),
  metaFilePath: text('meta_file_path').notNull(),
  name: text('name').notNull(),
  folder: text('folder').notNull(),
  author: text('author').notNull(),
  description: text('description').notNull(),
  uuid: text('uuid').notNull(),
  versionMajor: integer('version_major').notNull(),
  versionMinor: integer('version_minor').notNull(),
  versionRevision: integer('version_revision').notNull(),
  versionBuild: integer('version_build').notNull(),
  version64: text('version64').notNull(),
  ...timestamps
})

// Invariant: language1 < language2 (alphabetically sorted) - prevents mirrored duplicates.
// UID is metadata only. Matching and persistence are based on mod + source text, then source text.
export const dictionary = sqliteTable(
  'dictionary',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    language1: text('language1')
      .notNull()
      .references(() => language.code),
    language2: text('language2')
      .notNull()
      .references(() => language.code),
    textLanguage1: text('text_language1').notNull(),
    textLanguage2: text('text_language2').notNull(),
    textLanguage1Key: text('text_language1_key').notNull().default(''),
    textLanguage2Key: text('text_language2_key').notNull().default(''),
    modName: text('mod_name').references(() => mod.name),
    uid: text('uid'),
    ...timestamps
  },
  (table) => ({
    dictionary_langs_idx: index('dictionary_langs_idx').on(table.language1, table.language2),
    dictionary_langs_mod_idx: index('dictionary_langs_mod_idx').on(
      table.language1,
      table.language2,
      table.modName
    ),
    dictionary_mod_idx: index('dictionary_mod_idx').on(table.modName),
    dictionary_match_idx: index('dictionary_match_idx').on(
      table.language1,
      table.language2,
      table.modName,
      table.textLanguage1Key
    ),
    dictionary_match_uid_idx: index('dictionary_match_uid_idx').on(
      table.language1,
      table.language2,
      table.modName,
      table.uid,
      table.textLanguage1Key
    )
  })
)

export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value')
})

export type Language = typeof language.$inferSelect
export type Mod = typeof mod.$inferSelect
export type ModMeta = typeof modMeta.$inferSelect
export type NewModMeta = typeof modMeta.$inferInsert
export type DictionaryEntry = typeof dictionary.$inferSelect
export type NewDictionaryEntry = typeof dictionary.$inferInsert
