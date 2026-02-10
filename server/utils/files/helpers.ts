import { stat, readdir } from 'node:fs/promises'
import { join, extname, basename, resolve } from 'node:path'
import { lookup } from './mime'

/**
 * Root directory for the file manager.
 * Defaults to the current working directory. Can be overridden via FILES_ROOT env var.
 */
export function getFilesRoot(): string {
  return process.env.FILES_ROOT || process.cwd()
}

/** Available storage identifiers */
const STORAGES = ['local']

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------

/**
 * Parse a VueFinder path (e.g. "local://some/path") into storage + relative path.
 */
export function parsePath(vuefinderPath: string): { storage: string; relative: string } {
  if (!vuefinderPath) {
    return { storage: 'local', relative: '' }
  }
  if (vuefinderPath.includes('://')) {
    const idx = vuefinderPath.indexOf('://')
    const storage = vuefinderPath.slice(0, idx)
    const relative = vuefinderPath.slice(idx + 3)
    return { storage, relative }
  }
  return { storage: 'local', relative: vuefinderPath }
}

/**
 * Resolve a VueFinder path to an absolute filesystem path.
 * Throws if the resolved path escapes the root (path-traversal guard).
 */
export function resolveAbsolutePath(vuefinderPath: string): string {
  const { relative } = parsePath(vuefinderPath)
  const root = getFilesRoot()
  const abs = resolve(root, relative)

  // Guard against path traversal
  if (!abs.startsWith(root)) {
    throw createError({ statusCode: 403, message: 'Path traversal is not allowed' })
  }
  return abs
}

/**
 * Build a VueFinder-style path string from storage + relative.
 */
export function buildVuefinderPath(storage: string, relative: string): string {
  return `${storage}://${relative}`
}

// ---------------------------------------------------------------------------
// DirEntry builder
// ---------------------------------------------------------------------------

export interface DirEntry {
  dir: string
  basename: string
  extension: string
  path: string
  storage: string
  type: 'file' | 'dir'
  file_size: number | null
  last_modified: number
  mime_type: string | null
  visibility: string
}

/**
 * Build a DirEntry object for a single file or folder.
 */
export async function buildDirEntry(
  absPath: string,
  parentVuefinderPath: string,
  storage: string,
): Promise<DirEntry> {
  const stats = await stat(absPath)
  const name = basename(absPath)
  const ext = stats.isDirectory() ? '' : extname(name).replace(/^\./, '')
  const isDir = stats.isDirectory()

  return {
    dir: parentVuefinderPath,
    basename: name,
    extension: ext,
    path: parentVuefinderPath
      ? `${parentVuefinderPath}/${name}`
      : buildVuefinderPath(storage, name),
    storage,
    type: isDir ? 'dir' : 'file',
    file_size: isDir ? null : stats.size,
    last_modified: Math.floor(stats.mtimeMs / 1000),
    mime_type: isDir ? null : lookup(name),
    visibility: 'public',
  }
}

// ---------------------------------------------------------------------------
// Directory listing helper
// ---------------------------------------------------------------------------

export interface FsData {
  storages: string[]
  dirname: string
  read_only: boolean
  files: DirEntry[]
}

/**
 * List directory contents and return FsData.
 */
export async function listDirectory(vuefinderPath: string): Promise<FsData> {
  const { storage, relative } = parsePath(vuefinderPath)
  const absDir = resolveAbsolutePath(vuefinderPath)
  const dirname = buildVuefinderPath(storage, relative)

  let entries: string[]
  try {
    entries = await readdir(absDir)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError({ statusCode: 404, message: `Directory not found: ${dirname}` })
    }
    throw err
  }

  const files: DirEntry[] = []
  for (const name of entries) {
    // Skip hidden files starting with . (optional, but sensible default)
    if (name.startsWith('.')) continue
    try {
      const entry = await buildDirEntry(join(absDir, name), dirname, storage)
      files.push(entry)
    } catch {
      // Skip entries we can't stat (broken symlinks, etc.)
    }
  }

  // Sort: directories first, then alphabetically
  files.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.basename.localeCompare(b.basename)
  })

  return {
    storages: STORAGES,
    dirname,
    read_only: false,
    files,
  }
}

/**
 * Validate that required body fields are present. Throws 400 on missing fields.
 */
export function requireFields<T extends Record<string, unknown>>(
  body: T,
  fields: (keyof T)[],
): void {
  for (const field of fields) {
    if (body[field] == null || body[field] === '') {
      throw createError({
        statusCode: 400,
        message: `Missing required field: ${String(field)}`,
      })
    }
  }
}
