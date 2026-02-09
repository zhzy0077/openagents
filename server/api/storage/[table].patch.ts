import { getValidatedTable, validateWhereClause, withDatabase } from '../../utils/db/handler-helpers'
import { validateIdentifier, buildWhereClause, normalizeSqlValue } from '../../utils/db/query-builder'
import type { UpdateRequest, UpdateResponse } from '../../utils/db/types'

export default defineEventHandler(async (event): Promise<UpdateResponse> => {
  const table = getValidatedTable(event)

  const body = await readBody<UpdateRequest>(event)

  if (!body.data || typeof body.data !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Request body must include "data" object',
    })
  }

  validateWhereClause(body.where)

  return withDatabase((db) => {
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
  })
})
