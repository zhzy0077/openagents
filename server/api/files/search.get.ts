import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  resolveAbsolutePath,
  parsePath,
  buildVuefinderPath,
  buildDirEntry,
} from '../../utils/files/helpers'
import type { DirEntry } from '../../utils/files/helpers'

/**
 * GET /api/files/search — Search for files
 * Query: ?path=local://dir&filter=*.txt&deep=1&size=all
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = String(query.path || 'local://')
  const filter = String(query.filter || '')
  const deep = query.deep === '1' || query.deep === 'true'
  const size = String(query.size || 'all')

  const { storage, relative } = parsePath(path)
  const absDir = resolveAbsolutePath(path)
  const dirname = buildVuefinderPath(storage, relative)

  const results: DirEntry[] = []

  async function searchDir(dirAbs: string, dirVuefinder: string): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(dirAbs)
    } catch {
      return
    }

    for (const name of entries) {
      if (name.startsWith('.')) continue

      const entryAbs = join(dirAbs, name)
      let entryStat
      try {
        entryStat = await stat(entryAbs)
      } catch {
        continue
      }

      const isDir = entryStat.isDirectory()

      // Apply filter
      if (filter && !isDir) {
        if (!matchFilter(name, filter)) continue
      }

      // Apply size filter
      if (size !== 'all' && !isDir) {
        if (!matchSize(entryStat.size, size)) continue
      }

      if (!isDir || (isDir && filter === '')) {
        try {
          const entry = await buildDirEntry(entryAbs, dirVuefinder, storage)
          results.push(entry)
        } catch {
          // skip
        }
      }

      // Recurse into subdirectories if deep search
      if (isDir && deep) {
        const childVuefinder = dirVuefinder
          ? `${dirVuefinder}/${name}`
          : buildVuefinderPath(storage, name)
        await searchDir(entryAbs, childVuefinder)
      }
    }
  }

  await searchDir(absDir, dirname)

  return {
    storages: ['local'],
    dirname,
    files: results,
  }
})

/**
 * Match a filename against a filter pattern.
 * Supports simple glob patterns like "*.txt" or substring match.
 */
function matchFilter(filename: string, filter: string): boolean {
  const lower = filename.toLowerCase()
  const filterLower = filter.toLowerCase()

  // Glob: *.ext
  if (filterLower.startsWith('*.')) {
    const ext = filterLower.slice(1) // ".ext"
    return lower.endsWith(ext)
  }

  // Glob: name.*
  if (filterLower.endsWith('.*')) {
    const prefix = filterLower.slice(0, -2)
    return lower.startsWith(prefix)
  }

  // Substring match
  return lower.includes(filterLower)
}

/**
 * Match file size against a category.
 */
function matchSize(fileSize: number, size: string): boolean {
  const KB = 1024
  const MB = 1024 * KB

  switch (size) {
    case 'small': return fileSize < 100 * KB
    case 'medium': return fileSize >= 100 * KB && fileSize < 10 * MB
    case 'large': return fileSize >= 10 * MB
    default: return true
  }
}
