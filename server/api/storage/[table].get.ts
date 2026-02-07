import { getDatabase } from '../../utils/db/connection'
import { validateTableName, buildWhereClause, parseQueryParams, buildOrderByClause, buildLimitClause } from '../../utils/db/query-builder'
import type { SelectResponse } from '../../utils/db/types'

export default defineEventHandler(async (event): Promise<SelectResponse> => {
  const table = getRouterParam(event, 'table')
  if (!table) {
    throw createError({
      statusCode: 400,
      message: 'Table name is required',
    })
  }

  validateTableName(table)

  const query = getQuery(event)
  const options = parseQueryParams(query)

  const db = getDatabase()

  // Build SELECT query
  let sql = `SELECT * FROM ${table}`
  const params: unknown[] = []

  if (options.where) {
    const whereClause = buildWhereClause(options.where)
    sql += whereClause.sql
    params.push(...whereClause.params)
  }

  sql += buildOrderByClause(options.orderBy)
  sql += buildLimitClause(options.limit, options.offset)

  try {
    const stmt = db.prepare(sql)
    const rows = stmt.all(...params)

    return {
      rows,
      count: rows.length,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Database error: ${error.message}`,
    })
  }
})
