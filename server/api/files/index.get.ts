import { listDirectory } from '../../utils/files/helpers'

/**
 * GET /api/files — List directory contents
 * Query: ?path=local://some/path
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const path = String(query.path || 'local://')

  return await listDirectory(path)
})
