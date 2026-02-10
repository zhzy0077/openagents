# REST API: Non-Streaming Agent Prompt Endpoint

## TL;DR

> **Quick Summary**: Add a `POST /api/agent` endpoint that accepts a prompt and returns a single JSON response from an ACP-compatible coding agent. Server-side orchestration handles the full ACP lifecycle (spawn → initialize → session/new → prompt → collect → kill) per request.
> 
> **Deliverables**:
> - `server/api/agent.post.ts` — The REST handler
> - `shared/agent-presets.ts` — Extracted preset definitions (shared between client + server)
> - Updated `app/composables/useSettings.ts` — Re-import from shared location
> - Updated `nuxt.config.ts` — Add `OPENAGENTS_API_KEY` to runtimeConfig
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 (extract presets) → Task 2 (endpoint handler) → Task 3 (auth + validation) → Task 4 (integration QA)

---

## Context

### Original Request
User wants a REST API interface for calling an agent with a prompt — no streaming, just a single request → single response.

### Interview Summary
**Key Discussions**:
- **Session lifecycle**: Ephemeral — each request spawns fresh process, new session, returns response, kills process
- **Permissions**: Always auto-approve — agent gets full tool access
- **Response format**: Text only — just the final assistant text content, no tool calls/thinking/permissions
- **Agent selection**: Via request body `preset` field (e.g., `'claude-code'`, `'opencode'`)
- **Endpoint**: `POST /api/agent`
- **Timeout**: 120s default, configurable via request body
- **Auth**: Bearer token required (`Authorization: Bearer <key>`)

**Research Findings**:
- Existing `TransportFactory` (local + Docker) fully reusable — just pass a unique peerId
- `AcpConverter` already accumulates messages server-side, `currentMessage.content` holds only text (no thoughts/tool calls)
- `AGENT_PRESETS` currently lives in `app/composables/useSettings.ts` (client-only) — must extract to shared location
- ACP handshake sequence well-documented in `useChat.ts`: `initialize` → `session/new` → `session/prompt`
- Permission auto-approve pattern exists in `useChat.ts:316-322`: find option with value containing `'allow'`, fall back to first option
- No auth infrastructure exists anywhere — must be built from scratch (inline in handler)

### Metis Review
**Identified Gaps** (addressed):
- **Process leak on timeout**: Use `transport.destroy()` (SIGKILL) not `kill()` (SIGTERM). Cleanup in `finally` block.
- **Concurrent request exhaustion**: Noted as TODO for future — no limit in v1. Document the risk.
- **Permission handling at JSON-RPC level**: Must handle `session/request_permission` as raw JSON-RPC request via converter's `onPermissionRequest` callback, writing response directly to transport stdin.
- **Shared transport factory state collision**: Use `rest-${crypto.randomUUID()}` as peerId prefix.
- **cwd security**: Trust the token holder in v1 — if you have the API key, you have server access rights.
- **Partial response on timeout**: Return whatever text accumulated + `timedOut: true` flag.

---

## Work Objectives

### Core Objective
Create a stateless REST endpoint that wraps the ACP agent lifecycle into a single HTTP request-response, reusing existing transport and protocol infrastructure.

### Concrete Deliverables
- `POST /api/agent` endpoint accepting `{ prompt, preset?, cwd?, timeout? }`
- Bearer token authentication
- JSON response `{ response: string }` or `{ response: string, timedOut: true }` on timeout
- Shared presets importable by both frontend and server

### Definition of Done
- [x] `pnpm build` succeeds with zero errors
- [x] `POST /api/agent` without auth returns 401
- [x] `POST /api/agent` with valid auth + prompt returns 200 with `{ response }` (requires agent binary)
- [x] Frontend still compiles and presets work after extraction

### Must Have
- Bearer token auth via `OPENAGENTS_API_KEY` env var
- Full ACP handshake (initialize → session/new → session/prompt)
- Permission auto-approve (always allow)
- Configurable timeout with 120s default
- Process cleanup on all code paths (success, timeout, error)
- Input validation (prompt required, preset must be valid if provided)

### Must NOT Have (Guardrails)
- **NO streaming/SSE** — single JSON response only
- **NO retry logic** for failed agent spawns — fail fast with clear error
- **NO concurrency limiter** — out of scope for v1, noted as future TODO
- **NO separate utility/service files** for auth, validation, timeout — all inline in handler
- **NO OpenAPI/Swagger docs generation**
- **NO rate limiting middleware**
- **NO health-check or preset-discovery endpoints**
- **NO batch/multi-prompt support**
- **NO conversation persistence or session reuse**
- **NO database operations** — this is fully stateless
- **NO separate middleware file** for auth — inline check in the handler
- **NO tool call details, thinking, or permission data** in the response

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: NO (matching existing project convention)
- **Framework**: None

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

All verification via curl (API) and pnpm build (compilation). Detailed per-task below.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Extract AGENT_PRESETS to shared location
└── Task 2: Add OPENAGENTS_API_KEY to nuxt.config.ts runtimeConfig

Wave 2 (After Wave 1):
└── Task 3: Implement POST /api/agent handler (core endpoint)

Wave 3 (After Wave 2):
└── Task 4: Integration QA (end-to-end verification)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3 | 2 |
| 2 | None | 3 | 1 |
| 3 | 1, 2 | 4 | None |
| 4 | 3 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | quick (both are small, focused changes) |
| 2 | 3 | unspecified-high (main implementation logic) |
| 3 | 4 | quick (run verification commands) |

---

## TODOs

- [x] 1. Extract AGENT_PRESETS to shared location

  **What to do**:
  - Create `shared/agent-presets.ts` containing the `AgentPreset` interface and `AGENT_PRESETS` array
  - Update `app/composables/useSettings.ts` to import `AgentPreset` and `AGENT_PRESETS` from `#shared/agent-presets` instead of defining them locally
  - Verify the import path `#shared/agent-presets` works (the project uses `#shared/types/` pattern already, so `#shared/` is already mapped)
  
  **Must NOT do**:
  - Do NOT change the shape of `AgentPreset` or `AGENT_PRESETS` — exact same data, just moved
  - Do NOT modify any other files
  - Do NOT add new presets or change preset values

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file extraction — move existing code to new file, update one import
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `git-master`: No git operations in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `shared/types/acp.ts` — Example of shared type exports used by both server and client (shows `#shared/` import alias works)
  - `shared/types/chat.ts` — Another shared types file (naming/structure convention)

  **Source References** (code to extract):
  - `app/composables/useSettings.ts:1-24` — The `AgentPreset` interface (lines 1-7) and `AGENT_PRESETS` array (lines 9-24) to move
  - `app/composables/useAgentProcess.ts:4` — Imports `AGENT_PRESETS` from `~/composables/useSettings` — this import continues to work since `useSettings.ts` will re-export

  **Acceptance Criteria**:

  Agent-Executed QA Scenarios:

  ```
  Scenario: Build succeeds after preset extraction
    Tool: Bash
    Preconditions: Dependencies installed (pnpm install)
    Steps:
      1. Run: pnpm build
      2. Assert: Exit code 0
      3. Assert: No TypeScript errors in output
    Expected Result: Full build passes
    Evidence: Build output captured

  Scenario: Shared file exists with correct exports
    Tool: Bash
    Preconditions: File created
    Steps:
      1. Run: node -e "const m = require('./.nuxt/dist/server/chunks/shared/agent-presets.mjs'); console.log(JSON.stringify(Object.keys(m)))"
         OR simply verify file existence and content via grep:
         grep -c "AGENT_PRESETS" shared/agent-presets.ts
      2. Assert: Output shows AGENT_PRESETS is exported
      3. grep -c "AgentPreset" shared/agent-presets.ts
      4. Assert: Output shows AgentPreset is exported
    Expected Result: Both interface and array are exported from shared location
    Evidence: grep output captured

  Scenario: useSettings.ts still exports AGENT_PRESETS
    Tool: Bash
    Preconditions: Files updated
    Steps:
      1. grep "AGENT_PRESETS" app/composables/useSettings.ts
      2. Assert: Shows import or re-export (not local definition)
      3. grep "AgentPreset" app/composables/useSettings.ts
      4. Assert: Shows import or re-export
    Expected Result: useSettings imports from shared location, not defining locally
    Evidence: grep output captured
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `refactor: extract agent presets to shared location for server-side reuse`
  - Files: `shared/agent-presets.ts`, `app/composables/useSettings.ts`
  - Pre-commit: `pnpm build`

---

- [x] 2. Add OPENAGENTS_API_KEY to nuxt.config.ts runtimeConfig

  **What to do**:
  - Add `openagentsApiKey` to the private (non-public) section of `runtimeConfig` in `nuxt.config.ts`
  - Value comes from env var `NUXT_OPENAGENTS_API_KEY` (Nuxt auto-maps `NUXT_` prefix env vars to runtimeConfig keys)
  - Default to empty string `''` (endpoint returns 503 "API key not configured" when empty)

  The runtimeConfig should look like:
  ```typescript
  runtimeConfig: {
    openagentsApiKey: '',  // Set via NUXT_OPENAGENTS_API_KEY env var
    public: {
      wsEndpoint: 'ws://localhost:3000/ws/terminal'
    }
  }
  ```

  **Must NOT do**:
  - Do NOT put the key in `public` (it would be exposed to the browser)
  - Do NOT add middleware files
  - Do NOT modify any other config options

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line addition to config file
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: No git operations needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `nuxt.config.ts:21-25` — Existing `runtimeConfig` block showing structure (public section has `wsEndpoint`)

  **Documentation References**:
  - Nuxt runtimeConfig docs: private keys go at root level of `runtimeConfig`, accessed via `useRuntimeConfig()` in server code. Env var mapping: `NUXT_OPENAGENTS_API_KEY` → `runtimeConfig.openagentsApiKey`

  **Acceptance Criteria**:

  Agent-Executed QA Scenarios:

  ```
  Scenario: Build succeeds with new runtimeConfig key
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run: pnpm build
      2. Assert: Exit code 0
    Expected Result: Build passes
    Evidence: Build output captured

  Scenario: Config key exists in nuxt.config.ts
    Tool: Bash
    Steps:
      1. grep "openagentsApiKey" nuxt.config.ts
      2. Assert: Line found with empty string default
    Expected Result: Key present in config
    Evidence: grep output
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `refactor: extract agent presets to shared location for server-side reuse`
  - Files: `nuxt.config.ts`
  - Pre-commit: `pnpm build`

---

- [x] 3. Implement POST /api/agent handler

  **What to do**:
  - Create `server/api/agent.post.ts` with the full endpoint implementation
  - The handler must:

  **Step 1: Auth check**
  ```
  - Read `Authorization` header → extract Bearer token
  - Compare against `useRuntimeConfig().openagentsApiKey`
  - If key is empty/not configured → 503 "API key not configured"
  - If token missing or mismatch → 401 "Unauthorized"
  ```

  **Step 2: Parse and validate request body**
  ```
  - readBody(event) → { prompt: string, preset?: string, cwd?: string, timeout?: number }
  - Validate: prompt is non-empty string → 400 if missing
  - Validate: preset (if provided) exists in AGENT_PRESETS → 400 if invalid
  - Default preset to 'claude-code'
  - Default timeout to 120000 (ms), cap at 300000 (5 min)
  - Default cwd to '.' (or process.cwd())
  ```

  **Step 3: Spawn agent and run ACP handshake**
  - Generate unique peerId: `rest-${crypto.randomUUID()}`
  - Select transport factory based on `process.env.TRANSPORT` (same as terminal.ts)
  - Create `AcpConverter` instance
  - Wrap entire interaction in a `new Promise<string>` that resolves with final text
  - Track JSON-RPC request IDs: `let nextRequestId = 1`
  - Helper function: `sendJsonRpc(method, params)` → writes `JSON.stringify({ jsonrpc: '2.0', id: nextRequestId++, method, params }) + '\n'` to transport stdin
  
  **ACP Sequence (inside the Promise):**
  ```
  1. transport = transportFactory.create(peerId, preset.command, { args: preset.args, cwd }, callbacks)
  2. On stdout/stderr → converter.process(data)
  3. Set converter callbacks:
     - onResponse → route by request ID:
       • initializeRequestId → send session/new
       • newSessionRequestId → extract sessionId, send session/prompt
       • promptRequestId → resolve Promise with converter.getCurrentMessage()?.content ?? ''
     - onPermissionRequest(requestId, params) → auto-approve:
       • Find option with optionId containing 'allow', fall back to first option
       • Write JSON-RPC response: { jsonrpc: '2.0', id: requestId, result: { optionId } }\n to transport stdin
       • Also call converter.respondToPermission()
  4. On error → reject Promise
  5. On close (unexpected) → reject if not yet resolved
  6. Send initialize: sendJsonRpc('initialize', { protocolVersion: 1, clientCapabilities: {} })
  ```

  **Step 4: Timeout handling**
  - Use `Promise.race([agentPromise, timeoutPromise])`
  - On timeout: set `timedOut = true`, get partial text from `converter.getCurrentMessage()?.content ?? ''`
  
  **Step 5: Cleanup (ALWAYS in finally block)**
  ```
  converter.reset()
  transportFactory.cleanup(peerId)  // calls transport.destroy() → SIGKILL
  ```

  **Step 6: Return response**
  ```
  If timedOut:
    return { response: partialText, timedOut: true }
  Else:
    return { response: text }
  ```

  **Must NOT do**:
  - Do NOT import or use anything from `app/` directory (server cannot import client composables)
  - Do NOT create utility files — all logic inline in the handler
  - Do NOT add retry logic
  - Do NOT return tool calls, thinking, permission details
  - Do NOT persist anything to database
  - Do NOT add SSE/streaming support
  - Do NOT create separate auth middleware

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core implementation task — multi-step logic with ACP protocol, async/Promise orchestration, error handling
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No frontend work
    - `playwright`: No browser testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 2)
  - **Blocks**: Task 4
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References** (existing code to follow):
  - `server/routes/ws/terminal.ts:52-113` — Transport + converter lifecycle pattern: create converter, set callbacks, create transport with stdout/stderr → converter.process(), handle onClose with finalize()
  - `server/routes/ws/terminal.ts:132-159` — Permission response handling: construct JSON-RPC response, write to transport stdin, update converter state
  - `server/api/storage/[table].post.ts:1-49` — Handler structure pattern: `defineEventHandler`, `readBody`, `createError`, typed return
  - `server/routes/ws/terminal.ts:15-16` — Transport factory selection: `process.env.TRANSPORT === 'docker' ? dockerTransportFactory : localTransportFactory`

  **API/Type References** (contracts to implement against):
  - `shared/types/acp.ts:1-6` — `JsonRpcRequest` and `JsonRpcResponse` types for constructing JSON-RPC messages
  - `shared/types/acp.ts:190-195` — `InitializeResult` — response shape from `initialize` call (extract `agentCapabilities`)
  - `shared/types/acp.ts:220-231` — `NewSessionResult` — response shape from `session/new` (extract `sessionId`)
  - `shared/types/acp.ts:233-241` — `PromptResult` — response shape from `session/prompt` (contains `stopReason`, `usage`)
  - `shared/types/acp.ts:243-257` — `AcpPermissionRequestParams` — permission request params (extract `options[].optionId`)
  - `shared/types/chat.ts:56-62` — `ChatMessage` — final message shape (`content` field = text-only accumulated content)
  - `shared/agent-presets.ts` (created in Task 1) — `AgentPreset` interface and `AGENT_PRESETS` array

  **Protocol References** (ACP handshake sequence):
  - `app/composables/useChat.ts:120-125` — JSON-RPC message construction: `{ jsonrpc: '2.0', id, method, params } + '\n'`
  - `app/composables/useChat.ts:292` — Initialize call: `sendJsonRpc('initialize', { protocolVersion: 1, clientCapabilities: {} })`
  - `app/composables/useChat.ts:210` — New session: `sendJsonRpc('session/new', { cwd: sessionCwd, mcpServers: [] })`
  - `app/composables/useChat.ts:389-392` — Prompt: `sendJsonRpc('session/prompt', { sessionId, prompt: [{ type: 'text', text }] })`
  - `app/composables/useChat.ts:316-322` — Permission auto-approve logic: find option with value containing `'allow'`, fall back to first option

  **Transport References**:
  - `server/utils/transports/types.ts:1-36` — `TransportFactory`, `TransportOptions`, `TransportCallbacks`, `ProcessTransport` interfaces
  - `server/utils/transports/local.ts:65-122` — Local transport factory implementation
  - `server/utils/transports/base-factory.ts:31-38` — `cleanup()` calls `transport.destroy()` which sends SIGKILL

  **Converter References**:
  - `server/utils/acp-converter.ts:16-20` — `AcpConverterCallbacks` interface (onResponse, onConfigOptionsUpdate, onPermissionRequest)
  - `server/utils/acp-converter.ts:29-31` — `setCallbacks()` method
  - `server/utils/acp-converter.ts:51-53` — `getCurrentMessage()` returns accumulated ChatMessage (content = text only)
  - `server/utils/acp-converter.ts:63-68` — `reset()` method for cleanup
  - `server/utils/acp-converter.ts:76-82` — `respondToPermission()` for updating converter state after auto-approve

  **Acceptance Criteria**:

  Agent-Executed QA Scenarios:

  ```
  Scenario: Build succeeds with new endpoint
    Tool: Bash
    Preconditions: Tasks 1 and 2 complete
    Steps:
      1. Run: pnpm build
      2. Assert: Exit code 0
    Expected Result: Full build passes with new handler
    Evidence: Build output captured

  Scenario: Auth rejection — no token
    Tool: Bash
    Preconditions: Dev server running (pnpm dev), NUXT_OPENAGENTS_API_KEY=test-key-123
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/agent \
           -H "Content-Type: application/json" \
           -d '{"prompt": "hello"}'
      2. Assert: Last line (HTTP status) is "401"
      3. Assert: Response body contains "Unauthorized" or "unauthorized"
    Expected Result: Request rejected without auth
    Evidence: curl output captured

  Scenario: Auth rejection — wrong token
    Tool: Bash
    Preconditions: Dev server running, NUXT_OPENAGENTS_API_KEY=test-key-123
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/agent \
           -H "Content-Type: application/json" \
           -H "Authorization: Bearer wrong-key" \
           -d '{"prompt": "hello"}'
      2. Assert: Last line is "401"
    Expected Result: Wrong token rejected
    Evidence: curl output captured

  Scenario: Missing prompt validation
    Tool: Bash
    Preconditions: Dev server running, NUXT_OPENAGENTS_API_KEY=test-key-123
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/agent \
           -H "Content-Type: application/json" \
           -H "Authorization: Bearer test-key-123" \
           -d '{}'
      2. Assert: Last line is "400"
      3. Assert: Body mentions "prompt"
    Expected Result: Missing prompt rejected with clear message
    Evidence: curl output captured

  Scenario: Invalid preset validation
    Tool: Bash
    Preconditions: Dev server running, NUXT_OPENAGENTS_API_KEY=test-key-123
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/agent \
           -H "Content-Type: application/json" \
           -H "Authorization: Bearer test-key-123" \
           -d '{"prompt": "hello", "preset": "nonexistent-agent"}'
      2. Assert: Last line is "400"
      3. Assert: Body mentions "preset"
    Expected Result: Invalid preset rejected
    Evidence: curl output captured

  Scenario: Successful agent call (requires claude-code-acp binary)
    Tool: Bash
    Preconditions: Dev server running, NUXT_OPENAGENTS_API_KEY=test-key-123, claude-code-acp available
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/agent \
           -H "Content-Type: application/json" \
           -H "Authorization: Bearer test-key-123" \
           -d '{"prompt": "Say exactly: hello world", "timeout": 60000}' \
           --max-time 65
      2. Parse response JSON
      3. Assert: Last line is "200"
      4. Assert: Response has "response" key with non-empty string value
      5. Assert: Response does NOT have "toolCalls" or "thinking" keys
    Expected Result: Agent responds with text content
    Evidence: Full curl response captured

  Scenario: Timeout returns partial response
    Tool: Bash
    Preconditions: Dev server running, NUXT_OPENAGENTS_API_KEY=test-key-123, claude-code-acp available
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/agent \
           -H "Content-Type: application/json" \
           -H "Authorization: Bearer test-key-123" \
           -d '{"prompt": "hello", "timeout": 1000}' \
           --max-time 10
      2. Parse response JSON
      3. Assert: Response has "timedOut" key set to true
      4. Assert: Response has "response" key (may be empty string)
    Expected Result: Timeout handled gracefully with partial response
    Evidence: curl response captured

  Scenario: API key not configured returns 503
    Tool: Bash
    Preconditions: Dev server running WITHOUT NUXT_OPENAGENTS_API_KEY set (env var unset/empty)
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/agent \
           -H "Content-Type: application/json" \
           -H "Authorization: Bearer anything" \
           -d '{"prompt": "hello"}'
      2. Assert: Last line is "503"
      3. Assert: Body mentions "not configured"
    Expected Result: Clear error when server key not set
    Evidence: curl output captured
  ```

  **Commit**: YES
  - Message: `feat(api): add POST /api/agent endpoint for non-streaming agent prompt`
  - Files: `server/api/agent.post.ts`
  - Pre-commit: `pnpm build`

---

- [x] 4. Integration QA — end-to-end verification

  **What to do**:
  - Run the full verification suite against the running dev server
  - Execute all QA scenarios from Task 3 sequentially
  - Verify `pnpm build` succeeds (production build)
  - Verify frontend still works (presets load, settings page renders)

  **Must NOT do**:
  - Do NOT modify any code — this is verification only
  - Do NOT create test files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running existing commands and verifying output
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser UI verification needed (endpoint is API-only)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 3, final)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - Task 3 acceptance criteria — all QA scenarios defined there

  **Acceptance Criteria**:

  Agent-Executed QA Scenarios:

  ```
  Scenario: Full build verification
    Tool: Bash
    Steps:
      1. Run: pnpm build
      2. Assert: Exit code 0
      3. Assert: No TypeScript errors
    Expected Result: Production build succeeds
    Evidence: Build output captured

  Scenario: Run all API scenarios from Task 3
    Tool: Bash
    Preconditions: Dev server running with NUXT_OPENAGENTS_API_KEY=test-key-123
    Steps:
      1. Execute auth rejection (no token) → Assert 401
      2. Execute auth rejection (wrong token) → Assert 401
      3. Execute missing prompt → Assert 400
      4. Execute invalid preset → Assert 400
      5. Execute successful call (if agent binary available) → Assert 200 + response text
      6. Execute timeout scenario → Assert timedOut: true
    Expected Result: All scenarios pass
    Evidence: All curl outputs captured in .sisyphus/evidence/task-4-*.txt
  ```

  **Commit**: NO (verification only, no code changes)

---

## Commit Strategy

| After Task(s) | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 + 2 | `refactor: extract agent presets to shared location for server-side reuse` | `shared/agent-presets.ts`, `app/composables/useSettings.ts`, `nuxt.config.ts` | `pnpm build` |
| 3 | `feat(api): add POST /api/agent endpoint for non-streaming agent prompt` | `server/api/agent.post.ts` | `pnpm build` |

---

## Success Criteria

### Verification Commands
```bash
pnpm build                          # Exit 0, no TS errors
curl -X POST /api/agent (no auth)   # 401 Unauthorized
curl -X POST /api/agent (with auth) # 200 { response: "..." }
```

### Final Checklist
- [x] `POST /api/agent` exists and handles requests
- [x] Bearer token auth works (401 on missing/wrong, 503 on unconfigured)
- [x] Input validation works (400 on missing prompt, invalid preset)
- [x] Agent responds with text-only `{ response }` JSON
- [x] Timeout returns `{ response, timedOut: true }`
- [x] Process cleanup happens on all paths (no zombie processes)
- [x] `pnpm build` passes
- [x] Frontend presets still work after extraction
- [x] No tool calls, thinking, or permission data in response
- [x] No streaming, no SSE, no WebSocket — pure REST

### Future Considerations (out of scope)
- Concurrency limit (`MAX_CONCURRENT_AGENTS`)
- Rate limiting
- Request/response logging
- Persistent sessions (multi-turn conversations)
- Batch prompts
- Streaming variant (`GET /api/agent/stream` with SSE)
