# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-09
**Commit:** f6d9ec5
**Branch:** main

## OVERVIEW

OpenAgents is a Nuxt 4 chat UI for ACP-compatible coding agents over WebSocket terminal sessions. Stack: Nuxt 4, Vue 3.5, Nuxt UI, TypeScript, Nitro, SQLite (better-sqlite3), optional Docker transport.

## STRUCTURE

```
openagents/
|- app/
|  |- components/      # Chat UI components
|  |- composables/     # Session orchestration + transport state
|  |- pages/           # `/new` and `/chat/[id]` route surfaces
|  |- types/           # Domain + ACP protocol contracts
|  `- utils/           # Stateful ACP stream parser
|- server/
|  |- api/storage/     # Dynamic table CRUD handlers
|  |- routes/ws/       # WebSocket terminal bridge
|  `- utils/           # DB/query/transport internals
|- docs/screenshots/   # README screenshots
|- test-session-load.mjs # Manual ACP integration script
|- nuxt.config.ts
`- package.json
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Chat/session state machine | `app/composables/useChat.ts` | ACP initialize/new/load/list/prompt orchestration |
| Incremental ACP parsing | `app/utils/acpConverter.ts` | Line-buffered JSON-RPC parsing, tool/permission extraction |
| Browser WS lifecycle | `app/composables/useAgentProcess.ts` | Connect/reconnect queue and spawn/stdin/kill transport messages |
| Conversation persistence | `app/composables/useConversations.ts` | Conversation metadata CRUD via storage API |
| Main message rendering | `app/components/ChatPanel.vue` | Streamed assistant output + interaction events |
| Dynamic storage endpoints | `server/api/storage/[table].*.ts` | Generic CRUD with schema inference and guarded mutations |
| WS terminal endpoint | `server/routes/ws/terminal.ts` | Per-peer process transport lifecycle |
| SQL safety helpers | `server/utils/db/query-builder.ts` | Identifier validation + parameterized clause builders |
| SQLite lifecycle | `server/utils/db/connection.ts` | Singleton DB open, pragmas, schema bootstrap |
| Transport backends | `server/utils/transports/*.ts` | Local `child_process` and Docker implementations |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `useChat` | composable | `app/composables/useChat.ts` | Core ACP client state + request/response routing |
| `useAgentProcess` | composable | `app/composables/useAgentProcess.ts` | Browser WebSocket transport wrapper |
| `AcpConverter` | class | `app/utils/acpConverter.ts` | Incremental parser and message normalizer |
| `defineWebSocketHandler` export | route handler | `server/routes/ws/terminal.ts` | WebSocket protocol endpoint |
| `parseQueryParams` | function | `server/utils/db/query-builder.ts` | WHERE/orderBy/limit/offset parsing |
| `getDatabase` | function | `server/utils/db/connection.ts` | Lazy singleton DB initialization |

## FRONTEND CONVENTIONS

- Keep protocol handling in composables/utils; components render pre-shaped data only.
- Return readonly refs from composables; mutate only internally.
- Keep page files thin and push logic to composables.
- Keep typed `defineProps`/`defineEmits` signatures in components.
- Keep status-driven UI branches explicit (`connecting`, `streaming`, `ready`, `error`).

## BACKEND CONVENTIONS

- Validate dynamic table names/identifiers before SQL assembly.
- Keep SQL values parameterized (`?`) and clause generation centralized in query-builder helpers.
- Enforce non-empty `where` in PATCH/DELETE handlers.
- Wrap handler failures with `createError({ statusCode, message })`.
- Keep one active transport per peer and always cleanup on close/error.

## ANTI-PATTERNS (THIS PROJECT)

- Never edit `.nuxt/` or `.output/` artifacts.
- Never use npm/yarn/bun; pnpm workflow only.
- Never share one `AcpConverter` across multiple active chats.
- Never interpolate user-provided table/column/value data into SQL strings.
- Never bypass `validateTableName` / `validateIdentifier` for dynamic storage routes.
- Never run PATCH/DELETE storage operations with empty `where`.
- Never open ad-hoc SQLite handles outside `getDatabase()`.
- Never duplicate parsing/protocol branching inside Vue templates.

## UNIQUE STYLES

- ACP JSON-RPC messages may arrive fragmented; parser buffers by newline and finalizes streams.
- `useChat` guards spawn/exit races with `isSpawning` to avoid stale process exits clobbering state.
- Session title sync relies on `session/list`, not only prompt responses.
- Storage API infers table schema on first POST for previously unseen tables.

## COMMANDS

```bash
pnpm install
pnpm dev
pnpm lint          # Verify after changes — no need to run pnpm build
pnpm build
pnpm preview
node test-session-load.mjs
```

## NOTES

- No automated test framework configured (manual integration script only).
- No CI workflows in `.github/workflows`.
- Runtime WS endpoint defaults to `ws://localhost:3000/ws/terminal` in `nuxt.config.ts`.
- This repository uses a single AGENTS file at project root.
