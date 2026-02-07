import type { SelectResponse, InsertResponse, UpdateResponse, DeleteResponse, WhereClause } from '../../server/utils/db/types'

export interface StorageSelectOptions {
  where?: WhereClause
  orderBy?: string
  limit?: number
  offset?: number
}

export function useStorage() {
  const select = async <T = unknown>(
    table: string,
    options: StorageSelectOptions = {},
  ): Promise<T[]> => {
    const query: Record<string, string> = {}

    if (options.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        query[key] = String(value)
      })
    }

    if (options.orderBy) {
      query.orderBy = options.orderBy
    }

    if (options.limit !== undefined) {
      query.limit = String(options.limit)
    }

    if (options.offset !== undefined) {
      query.offset = String(options.offset)
    }

    const response = await $fetch<SelectResponse>(`/api/storage/${table}`, {
      method: 'GET',
      query,
    })

    return response.rows as T[]
  }

  const insert = async <T extends Record<string, unknown>>(
    table: string,
    rows: T[],
  ): Promise<InsertResponse> => {
    return await $fetch<InsertResponse>(`/api/storage/${table}`, {
      method: 'POST',
      body: rows,
    })
  }

  const update = async (
    table: string,
    data: Record<string, unknown>,
    where: WhereClause,
  ): Promise<UpdateResponse> => {
    return await $fetch<UpdateResponse>(`/api/storage/${table}`, {
      method: 'PATCH',
      body: { data, where },
    })
  }

  const remove = async (
    table: string,
    where: WhereClause,
  ): Promise<DeleteResponse> => {
    return await $fetch<DeleteResponse>(`/api/storage/${table}`, {
      method: 'DELETE',
      body: { where },
    })
  }

  return {
    select,
    insert,
    update,
    remove,
  }
}
