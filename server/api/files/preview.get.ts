import { readFile, stat } from 'node:fs/promises'
import { resolveAbsolutePath } from '../../utils/files/helpers'
import { lookup } from '../../utils/files/mime'
import { basename } from 'node:path'

/**
 * GET /api/files/preview — Get file content for preview
 * Query: ?path=local://some/file.txt
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = String(query.path || '')

  if (!path) {
    throw createError({ statusCode: 400, message: 'path query parameter is required' })
  }

  const absPath = resolveAbsolutePath(path)

  try {
    await stat(absPath)
  } catch {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const content = await readFile(absPath)
  const mimeType = lookup(basename(absPath))

  setResponseHeaders(event, {
    'Content-Type': mimeType,
    'Content-Length': content.length.toString(),
  })

  return content
})
