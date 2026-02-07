import { getDatabase } from '../../utils/db/connection'
import { validateTableName, validateIdentifier, inferSchema, createTableIfNotExists, normalizeSqlValue } from '../../utils/db/query-builder'
import type { InsertResponse } from '../../utils/db/types'

export default defineEventHandler(async (event): Promise<InsertResponse> => {
  const table = getRouterParam(event, 'table')
  if (!table) {
    throw createError({
      statusCode: 400,
      message: 'Table name is required',
    })
  }

  validateTableName(table)

  const body = await readBody(event)

  if (!Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      message: 'Request body must be an array of objects',
    })
  }

  if (body.length === 0) {
    return { inserted: 0 }
  }

  const db = getDatabase()

  try {
    // Infer schema from first row and create table if needed
    const firstRow = body[0]
    const schema = inferSchema(firstRow)
    createTableIfNotExists(db, table, schema)

    // Validate all columns exist in first row
    const columns = Object.keys(firstRow)
    columns.forEach(validateIdentifier)

    // Build INSERT query
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`

    // Use transaction for multiple inserts
    const insert = db.prepare(sql)
    const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const values = columns.map(col => normalizeSqlValue(row[col]))
        insert.run(...values)
      }
    })

    insertMany(body)

    return { inserted: body.length }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Database error: ${error.message}`,
    })
  }
})
