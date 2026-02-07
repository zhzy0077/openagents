import { getDatabase } from '../../utils/db/connection'
import { validateTableName, buildWhereClause } from '../../utils/db/query-builder'
import type { DeleteRequest, DeleteResponse } from '../../utils/db/types'

export default defineEventHandler(async (event): Promise<DeleteResponse> => {
  const table = getRouterParam(event, 'table')
  if (!table) {
    throw createError({
      statusCode: 400,
      message: 'Table name is required',
    })
  }

  validateTableName(table)

  const body = await readBody<DeleteRequest>(event)

  if (!body.where || typeof body.where !== 'object' || Object.keys(body.where).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Request body must include non-empty "where" clause',
    })
  }

  const db = getDatabase()

  try {
    const whereClause = buildWhereClause(body.where)
    const sql = `DELETE FROM ${table}${whereClause.sql}`

    const stmt = db.prepare(sql)
    const result = stmt.run(...whereClause.params)

    return { changes: result.changes }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: `Database error: ${error.message}`,
    })
  }
})
