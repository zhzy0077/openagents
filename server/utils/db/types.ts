export interface WhereClause {
  [column: string]: string | number | boolean | null
}

export interface UpdateRequest {
  data: Record<string, unknown>
  where: WhereClause
}

export interface DeleteRequest {
  where: WhereClause
}

export interface SelectOptions {
  where?: WhereClause
  orderBy?: string
  limit?: number
  offset?: number
}

export interface SelectResponse {
  rows: unknown[]
  count: number
}

export interface InsertResponse {
  inserted: number
}

export interface UpdateResponse {
  changes: number
}

export interface DeleteResponse {
  changes: number
}
