import { writeFile, readFile } from 'node:fs/promises'
import { resolveAbsolutePath, requireFields } from '../../utils/files/helpers'
import { lookup } from '../../utils/files/mime'
import { basename } from 'node:path'

/**
 * POST /api/files/save — Save file content
 * Body: { path: "local://some/file.txt", content: "file content here" }
 * Response: returns the saved file content with appropriate Content-Type
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string; content: string }>(event)
  requireFields(body, ['path'])

  const absPath = resolveAbsolutePath(body.path)

  try {
    await writeFile(absPath, body.content ?? '')
  } catch (err: unknown) {
    throw createError({
      statusCode: 500,
      message: `Failed to save file: ${(err as Error).message}`,
    })
  }

  // Return the saved file content (matching VueFinder's expected behavior)
  const content = await readFile(absPath)
  const mimeType = lookup(basename(absPath))

  setResponseHeaders(event, {
    'Content-Type': mimeType,
    'Content-Length': content.length.toString(),
  })

  return content
})
