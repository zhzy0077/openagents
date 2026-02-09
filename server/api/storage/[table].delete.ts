import { getValidatedTable, validateWhereClause, withDatabase } from '../../utils/db/handler-helpers'
import { buildWhereClause } from '../../utils/db/query-builder'
import type { DeleteRequest, DeleteResponse } from '../../utils/db/types'

export default defineEventHandler(async (event): Promise<DeleteResponse> => {
  const table = getValidatedTable(event)

  const body = await readBody<DeleteRequest>(event)

  validateWhereClause(body.where)

  return withDatabase((db) => {
    const whereClause = buildWhereClause(body.where)
    const sql = `DELETE FROM ${table}${whereClause.sql}`

    const stmt = db.prepare(sql)
    const result = stmt.run(...whereClause.params)

    return { changes: result.changes }
  })
})
