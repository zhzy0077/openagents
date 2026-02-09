import { getValidatedTable, withDatabase } from '../../utils/db/handler-helpers'
import { parseQueryParams, buildWhereClause, buildOrderByClause, buildLimitClause } from '../../utils/db/query-builder'
import type { SelectResponse } from '../../utils/db/types'

export default defineEventHandler(async (event): Promise<SelectResponse> => {
  const table = getValidatedTable(event)

  const query = getQuery(event)
  const options = parseQueryParams(query)

  return withDatabase((db) => {
    let sql = `SELECT * FROM ${table}`
    const params: unknown[] = []

    if (options.where) {
      const whereClause = buildWhereClause(options.where)
      sql += whereClause.sql
      params.push(...whereClause.params)
    }

    sql += buildOrderByClause(options.orderBy)
    sql += buildLimitClause(options.limit, options.offset)

    const stmt = db.prepare(sql)
    const rows = stmt.all(...params)

    return {
      rows,
      count: rows.length,
    }
  })
})
