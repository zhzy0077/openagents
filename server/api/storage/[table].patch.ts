import { getDatabase } from '../../utils/db/connection'
import { validateTableName, validateIdentifier, buildWhereClause, normalizeSqlValue } from '../../utils/db/query-builder'
import type { UpdateRequest, UpdateResponse } from '../../utils/db/types'

export default defineEventHandler(async (event): Promise<UpdateResponse> => {
  const table = getRouterParam(event, 'table')
  if (!table) {
    throw createError({
      statusCode: 400,
      message: 'Table name is required',
    })
  }

  validateTableName(table)

  const body = await readBody<UpdateRequest>(event)

  if (!body.data || typeof body.data !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Request body must include "data" object',
    })
  }

  if (!body.where || typeof body.where !== 'object' || Object.keys(body.where).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Request body must include non-empty "where" clause',
    })
  }

  const db = getDatabase()

  try {
    // Build UPDATE query
    const setColumns = Object.keys(body.data)
    setColumns.forEach(validateIdentifier)

    const setClauses = setColumns.map(col => `${col} = ?`).join(', ')
    const setParams = setColumns.map(col => normalizeSqlValue(body.data[col]))

    const whereClause = buildWhereClause(body.where)

    const sql = `UPDATE ${table} SET ${setClauses}${whereClause.sql}`
    const params = [...setParams, ...whereClause.params]

    const stmt = db.prepare(sql)
    const result = stmt.run(...params)

    return { changes: result.changes }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Database error: ${error.message}`,
    })
  }
})
