import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveAbsolutePath, listDirectory, requireFields } from '../../utils/files/helpers'

/**
 * POST /api/files/create-file — Create a new empty file
 * Body: { path: "local://parent", name: "file.txt" }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string; name: string }>(event)
  requireFields(body, ['path', 'name'])

  const parentAbs = resolveAbsolutePath(body.path)
  const newFilePath = join(parentAbs, body.name)

  // Guard: name must not contain path separators
  if (body.name.includes('/') || body.name.includes('\\')) {
    throw createError({ statusCode: 400, message: 'File name must not contain path separators' })
  }

  try {
    // wx flag: create only, fail if exists
    await writeFile(newFilePath, '', { flag: 'wx' })
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EEXIST') {
      throw createError({ statusCode: 409, message: 'File already exists' })
    }
    throw createError({ statusCode: 500, message: `Failed to create file: ${(err as Error).message}` })
  }

  return await listDirectory(body.path)
})
