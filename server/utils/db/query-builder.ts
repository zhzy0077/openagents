import type { WhereClause, SelectOptions } from './types'
import type Database from 'better-sqlite3'

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const RESERVED_TABLES = ['_schema_registry']

export function validateIdentifier(name: string): void {
  if (!IDENTIFIER_REGEX.test(name)) {
    throw new Error(`Invalid identifier: ${name}`)
  }
}

export function validateTableName(table: string): void {
  validateIdentifier(table)
  if (RESERVED_TABLES.includes(table)) {
    throw new Error(`Reserved table name: ${table}`)
  }
}

export function normalizeSqlValue(value: unknown): string | number | null | Buffer {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (typeof value === 'string' || typeof value === 'number' || Buffer.isBuffer(value)) {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  // For objects and arrays, convert to JSON string
  return JSON.stringify(value)
}

export function buildWhereClause(where: WhereClause): { sql: string, params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []

  for (const [column, value] of Object.entries(where)) {
    validateIdentifier(column)
    conditions.push(`${column} = ?`)
    params.push(normalizeSqlValue(value))
  }

  if (conditions.length === 0) {
    return { sql: '', params: [] }
  }

  return {
    sql: ` WHERE ${conditions.join(' AND ')}`,
    params,
  }
}

export function parseQueryParams(query: Record<string, unknown>): SelectOptions {
  const options: SelectOptions = {}
  const where: WhereClause = {}

  for (const [key, value] of Object.entries(query)) {
    if (key === 'orderBy') {
      options.orderBy = String(value)
    } else if (key === 'limit') {
      const num = Number(value)
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new Error('Invalid limit: must be a non-negative integer')
      }
      options.limit = num
    } else if (key === 'offset') {
      const num = Number(value)
      if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) {
        throw new Error('Invalid offset: must be a non-negative integer')
      }
      options.offset = num
    } else {
      // All other params are WHERE conditions (equality only)
      where[key] = value as string | number | boolean | null
    }
  }

  if (Object.keys(where).length > 0) {
    options.where = where
  }

  return options
}

export function buildOrderByClause(orderBy?: string): string {
  if (!orderBy) {
    return ''
  }

  const parts = orderBy.split(':')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid orderBy format. Expected "column:asc" or "column:desc"')
  }

  const column = parts[0]
  const direction = parts[1]
  validateIdentifier(column)

  const dir = direction.toLowerCase()
  if (dir !== 'asc' && dir !== 'desc') {
    throw new Error('Invalid sort direction. Expected "asc" or "desc"')
  }

  return ` ORDER BY ${column} ${dir.toUpperCase()}`
}

export function buildLimitClause(limit?: number, offset?: number): string {
  if (limit === undefined || limit <= 0) {
    return ''
  }

  let sql = ` LIMIT ${limit}`

  if (offset !== undefined && offset > 0) {
    sql += ` OFFSET ${offset}`
  }

  return sql
}

export function inferSchema(data: Record<string, unknown>): Map<string, string> {
  const schema = new Map<string, string>()

  for (const [key, value] of Object.entries(data)) {
    validateIdentifier(key)

    let sqlType = 'TEXT'
    if (typeof value === 'number') {
      sqlType = Number.isInteger(value) ? 'INTEGER' : 'REAL'
    } else if (typeof value === 'boolean') {
      sqlType = 'INTEGER'
    } else if (value === null) {
      sqlType = 'TEXT'
    }

    schema.set(key, sqlType)
  }

  return schema
}

export function createTableIfNotExists(db: Database.Database, table: string, schema: Map<string, string>): void {
  const columns = Array.from(schema.entries())
    .map(([name, type]) => `${name} ${type}`)
    .join(', ')

  const sql = `CREATE TABLE IF NOT EXISTS ${table} (${columns})`
  db.exec(sql)
}
