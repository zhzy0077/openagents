# SERVER (Nitro Backend)

## OVERVIEW

Nitro server providing REST CRUD for dynamic SQLite tables and a WebSocket endpoint for terminal process management.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new API endpoint | `api/` | Follow `[param].method.ts` naming convention |
| Modify storage CRUD | `api/storage/[table].*.ts` | Each HTTP method is a separate file |
| Database queries | `utils/db/query-builder.ts` | All SQL generation with validation |
| Database connection | `utils/db/connection.ts` | Singleton, lazy-init, WAL mode |
| WebSocket handler | `routes/ws/terminal.ts` | Spawn/stdin/kill message protocol |
| Process lifecycle | `utils/process-manager.ts` | One child process per WS peer ID |

## CONVENTIONS

- **File naming**: `[param].method.ts` for API routes (e.g., `[table].get.ts`)
- **Route naming**: `routes/` for non-API routes (WebSocket lives here, not in `api/`)
- **Error handling**: Always `throw createError({ statusCode, message })` — never return raw errors
- **SQL safety**: All identifiers validated via `validateIdentifier()` regex; all values parameterized
- **Body parsing**: `readBody<T>(event)` with explicit type parameter
- **Query parsing**: `getQuery(event)` → `parseQueryParams()` separates where/orderBy/limit/offset

## API: Storage Endpoints

All endpoints operate on dynamic tables at `/api/storage/[table]`:

| Method | Body | Behavior |
|--------|------|----------|
| GET | Query params as WHERE filters | SELECT with optional orderBy, limit, offset |
| POST | Array of row objects | Auto-creates table from first row schema, bulk INSERT |
| PATCH | `{ data, where }` | UPDATE matching rows |
| DELETE | `{ where }` | DELETE matching rows (where required, no mass delete) |

## API: WebSocket Protocol

Client → Server messages at `/ws/terminal`:

| Type | Fields | Action |
|------|--------|--------|
| `spawn` | `command`, `args?`, `cwd?`, `env?` | Spawn child process |
| `stdin` | `data` | Write to process stdin |
| `kill` | `signal?` | Kill process (default: SIGTERM) |

Server → Client responses:

| Type | Fields | When |
|------|--------|------|
| `spawned` | `pid` | After successful spawn |
| `stdout` | `data` | Process stdout output |
| `stderr` | `data` | Process stderr output |
| `exit` | `code`, `signal` | Process terminated |
| `error` | `message` | Invalid command or spawn failure |

## ANTI-PATTERNS

- NEVER skip `validateTableName()` / `validateIdentifier()` — SQL injection risk
- NEVER allow DELETE/UPDATE without a WHERE clause — enforced in handlers
- NEVER create multiple DB connections — `getDatabase()` returns singleton
- Table `_schema_registry` is reserved — blocked in query-builder
