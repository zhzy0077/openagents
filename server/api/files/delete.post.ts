import { rm } from 'node:fs/promises'
import { resolveAbsolutePath, listDirectory, requireFields } from '../../utils/files/helpers'

interface DeleteItem {
  path: string
  type: 'file' | 'dir'
}

/**
 * POST /api/files/delete — Delete one or more files/folders
 * Body: { path: "local://parent", items: [{ path: "local://parent/file.txt", type: "file" }] }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string; items: DeleteItem[] }>(event)
  requireFields(body, ['path', 'items'])

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, message: 'Items array must not be empty' })
  }

  for (const item of body.items) {
    const absPath = resolveAbsolutePath(item.path)
    try {
      await rm(absPath, { recursive: true, force: true })
    } catch (err: unknown) {
      throw createError({
        statusCode: 500,
        message: `Failed to delete ${item.path}: ${(err as Error).message}`,
      })
    }
  }

  return await listDirectory(body.path)
})
