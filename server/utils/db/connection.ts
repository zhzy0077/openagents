import Database from 'better-sqlite3'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

let db: Database.Database | null = null

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      preset TEXT NOT NULL DEFAULT 'claude-code',
      updatedAt TEXT NOT NULL
    )
  `)
}

export function getDatabase(): Database.Database {
  if (db) {
    return db
  }

  // Ensure .data directory exists
  const dataDir = join(process.cwd(), '.data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = join(dataDir, 'storage.db')
  db = new Database(dbPath)

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initializeSchema(db)

  return db
}
