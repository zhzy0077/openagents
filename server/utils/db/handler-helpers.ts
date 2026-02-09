import type { H3Event } from 'h3'
import { getDatabase } from './connection'
import { validateTableName } from './query-builder'
import type Database from 'better-sqlite3'

/**
 * Extracts and validates the table name from the route parameter.
 * Throws a 400 error if missing or invalid.
 */
export function getValidatedTable(event: H3Event): string {
  const table = getRouterParam(event, 'table')
  if (!table) {
    throw createError({
      statusCode: 400,
      message: 'Table name is required',
    })
  }

  validateTableName(table)
  return table
}

/**
 * Validates that a `where` clause is a non-empty object.
 * Throws a 400 error if the clause is missing, not an object, or empty.
 */
export function validateWhereClause(where: unknown): asserts where is Record<string, unknown> {
  if (!where || typeof where !== 'object' || Object.keys(where).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Request body must include non-empty "where" clause',
    })
  }
}

/**
 * Wraps a database operation with consistent error handling.
 * Catches errors and re-throws as a 500 HTTP error with a descriptive message.
 */
export function withDatabase<T>(fn: (db: Database.Database) => T): T {
  const db = getDatabase()
  try {
    return fn(db)
  } catch (error: unknown) {
    throw createError({
      statusCode: 500,
      message: `Database error: ${error instanceof Error ? error.message : String(error)}`,
    })
  }
}
