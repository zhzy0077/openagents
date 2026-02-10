import { rename as fsRename } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { resolveAbsolutePath, listDirectory, requireFields } from '../../utils/files/helpers'

/**
 * POST /api/files/move — Move files/folders to a destination
 * Body: { path: "local://current", sources: ["local://a/file.txt"], destination: "local://target" }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ path?: string; sources: string[]; destination: string }>(event)
  requireFields(body, ['sources', 'destination'])

  if (!Array.isArray(body.sources) || body.sources.length === 0) {
    throw createError({ statusCode: 400, message: 'Sources array must not be empty' })
  }

  const destAbs = resolveAbsolutePath(body.destination)

  for (const source of body.sources) {
    const sourceAbs = resolveAbsolutePath(source)
    const name = basename(sourceAbs)
    const targetPath = join(destAbs, name)

    try {
      await fsRename(sourceAbs, targetPath)
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        throw createError({ statusCode: 404, message: `Source not found: ${source}` })
      }
      throw createError({ statusCode: 500, message: `Failed to move ${source}: ${(err as Error).message}` })
    }
  }

  return await listDirectory(body.destination)
})
