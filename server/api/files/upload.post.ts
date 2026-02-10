import { join } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolveAbsolutePath, listDirectory, requireFields } from '../../utils/files/helpers'

/**
 * POST /api/files/upload — Upload files
 * Uses multipart/form-data. The VueFinder uploader (Uppy/XHR) sends files
 * with field name "file" and metadata field "path" for the target directory.
 */
export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    throw createError({ statusCode: 400, message: 'No file data received' })
  }

  // Extract path from the form data metadata or query params
  const query = getQuery(event)
  let targetPath = String(query.path || '')

  // Check form fields for path metadata
  for (const part of formData) {
    if (part.name === 'path' && part.data) {
      targetPath = part.data.toString('utf-8')
      break
    }
  }

  if (!targetPath) {
    throw createError({ statusCode: 400, message: 'Target path is required' })
  }

  const targetAbs = resolveAbsolutePath(targetPath)

  // Ensure target directory exists
  try {
    await mkdir(targetAbs, { recursive: true })
  } catch {
    // Directory might already exist, that's fine
  }

  // Process file parts
  for (const part of formData) {
    if (part.name === 'file' && part.data) {
      const fileName = part.filename || 'unnamed'

      // Guard: filename must not contain path separators
      if (fileName.includes('/') || fileName.includes('\\')) {
        throw createError({ statusCode: 400, message: 'Filename must not contain path separators' })
      }

      const filePath = join(targetAbs, fileName)
      await writeFile(filePath, part.data)
    }
  }

  // Return empty object on success (VueFinder convention)
  return {}
})
