import { getDatabase } from '../utils/db/connection'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(() => {
  try {
    const db = getDatabase()
    const dataDir = join(process.cwd(), '.data')

    return {
      cwd: process.cwd(),
      dbPath: db.name,
      dbExists: existsSync(db.name),
      dataDirExists: existsSync(dataDir),
      dataDirContents: existsSync(dataDir) ? readdirSync(dataDir) : [],
    }
  } catch (error: any) {
    return {
      error: error.message,
      stack: error.stack,
    }
  }
})
