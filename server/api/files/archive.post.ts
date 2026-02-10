import { createWriteStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { listDirectory, requireFields, resolveAbsolutePath } from '../../utils/files/helpers'

/**
 * POST /api/files/archive — Create a ZIP archive
 * Body: { path: "local://parent", name: "archive.zip", items: [{ path: "...", type: "file"|"dir" }] }
 *
 * NOTE: Requires the 'archiver' npm package (optional dependency).
 * Install with: pnpm add archiver @types/archiver
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ path: string; name: string; items: Array<{ path: string; type: string }> }>(event)
  requireFields(body, ['path', 'name', 'items'])

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, message: 'Items array must not be empty' })
  }

  // Guard: name must end with .zip
  if (!body.name.endsWith('.zip')) {
    throw createError({ statusCode: 400, message: 'Archive name must end with .zip' })
  }

  // Dynamic import to avoid hard dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let archiverModule: any
  try {
    archiverModule = await import('archiver' as string)
  } catch {
    throw createError({
      statusCode: 501,
      message: 'Archive feature requires the "archiver" package. Install with: pnpm add archiver @types/archiver',
    })
  }

  const parentAbs = resolveAbsolutePath(body.path)
  const archivePath = join(parentAbs, body.name)

  return new Promise(async (resolve, reject) => {
    try {
      const output = createWriteStream(archivePath)
      const archiverFn = archiverModule.default || archiverModule
      const archive = archiverFn('zip', { zlib: { level: 9 } })

      output.on('close', async () => {
        try {
          const result = await listDirectory(body.path)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      })

      archive.on('error', (err: Error) => {
        reject(createError({ statusCode: 500, message: `Archive error: ${err.message}` }))
      })

      archive.pipe(output)

      for (const item of body.items) {
        const itemAbs = resolveAbsolutePath(item.path)
        const itemStat = await stat(itemAbs)

        if (itemStat.isDirectory()) {
          archive.directory(itemAbs, basename(itemAbs))
        } else {
          archive.file(itemAbs, { name: basename(itemAbs) })
        }
      }

      await archive.finalize()
    } catch (err) {
      reject(createError({ statusCode: 500, message: `Failed to create archive: ${(err as Error).message}` }))
    }
  })
})
