import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveAbsolutePath, listDirectory, requireFields } from '../../utils/files/helpers'

/**
 * POST /api/files/create-folder — Create a new folder
 * Body: { path: "local://parent", name: "folder-name" }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string; name: string }>(event)
  requireFields(body, ['path', 'name'])

  const parentAbs = resolveAbsolutePath(body.path)
  const newFolderPath = join(parentAbs, body.name)

  // Guard: name must not contain path separators
  if (body.name.includes('/') || body.name.includes('\\')) {
    throw createError({ statusCode: 400, message: 'Folder name must not contain path separators' })
  }

  try {
    await mkdir(newFolderPath, { recursive: false })
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EEXIST') {
      throw createError({ statusCode: 409, message: 'Folder already exists' })
    }
    throw createError({ statusCode: 500, message: `Failed to create folder: ${(err as Error).message}` })
  }

  return await listDirectory(body.path)
})
