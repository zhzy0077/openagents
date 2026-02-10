import { rename as fsRename } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { resolveAbsolutePath, listDirectory, requireFields } from '../../utils/files/helpers'

/**
 * POST /api/files/rename — Rename a file or folder
 * Body: { path: "local://parent", item: "local://parent/old-name", name: "new-name" }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string; item: string; name: string }>(event)
  requireFields(body, ['path', 'item', 'name'])

  const itemAbs = resolveAbsolutePath(body.item)
  const parentDir = dirname(itemAbs)
  const newPath = join(parentDir, body.name)

  // Guard: name must not contain path separators
  if (body.name.includes('/') || body.name.includes('\\')) {
    throw createError({ statusCode: 400, message: 'Name must not contain path separators' })
  }

  try {
    await fsRename(itemAbs, newPath)
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw createError({ statusCode: 404, message: 'Item not found' })
    }
    throw createError({ statusCode: 500, message: `Failed to rename: ${(err as Error).message}` })
  }

  return await listDirectory(body.path)
})
