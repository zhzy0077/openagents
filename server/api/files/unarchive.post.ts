import { createReadStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { listDirectory, requireFields, resolveAbsolutePath } from '../../utils/files/helpers'

/**
 * POST /api/files/unarchive — Extract a ZIP archive
 * Body: { item: "local://parent/archive.zip", path: "local://parent" }
 *
 * NOTE: Requires the 'unzipper' npm package (optional dependency).
 * Install with: pnpm add unzipper @types/unzipper
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ item: string; path: string }>(event)
  requireFields(body, ['item', 'path'])

  // Dynamic import to avoid hard dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let unzipperModule: any
  try {
    unzipperModule = await import('unzipper' as string)
  } catch {
    throw createError({
      statusCode: 501,
      message: 'Unarchive feature requires the "unzipper" package. Install with: pnpm add unzipper @types/unzipper',
    })
  }

  const archiveAbs = resolveAbsolutePath(body.item)
  const destAbs = resolveAbsolutePath(body.path)

  // Ensure destination exists
  await mkdir(destAbs, { recursive: true })

  const Extract = unzipperModule.Extract || unzipperModule.default?.Extract
  if (!Extract) {
    throw createError({ statusCode: 500, message: 'Unzipper module does not export Extract' })
  }

  return new Promise((resolve, reject) => {
    const stream = createReadStream(archiveAbs)
      .pipe(Extract({ path: destAbs }))

    stream.on('close', async () => {
      try {
        const result = await listDirectory(body.path)
        resolve(result)
      } catch (err) {
        reject(err)
      }
    })

    stream.on('error', (err: Error) => {
      reject(createError({ statusCode: 500, message: `Unarchive error: ${err.message}` }))
    })
  })
})
