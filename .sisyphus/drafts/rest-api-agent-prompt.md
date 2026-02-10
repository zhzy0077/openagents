# Draft: REST API for Non-Streaming Agent Prompt

## Requirements (confirmed)
- Single HTTP endpoint to call an agent with a prompt
- Non-streaming: one request in, one response out (no WebSocket)
- Returns the final agent response to the user

## Research Findings
- **Current architecture**: Stateful WebSocket-based. Flow: spawn process → initialize ACP → session/new → session/prompt → stream chunks → response.
- **ACP protocol**: JSON-RPC 2.0 over newline-delimited stdout/stderr. Requires multi-step handshake: initialize → session/new|load → session/prompt.
- **Transport layer**: Abstracted via TransportFactory (local child_process or Docker). Reusable for REST.
- **AcpConverter**: Server-side line-buffered parser that can accumulate all messages until finalization. Perfect for REST wrapping.
- **Presets**: `claude-code` (command: `claude-code-acp`) and `opencode` (command: `opencode`, args: `["acp"]`)
- **Permissions**: Agent may request permission mid-stream. Must decide: auto-approve, reject, or require caller to specify.
- **Existing API patterns**: Nitro `defineEventHandler`, `createError({ statusCode, message })`, typed request/response.

## Technical Decisions
- **Session lifecycle**: Ephemeral — each request spawns a fresh process, creates new session, returns response, kills process
- **Permission handling**: Always auto-approve — agent gets full tool access
- **Response detail**: Text only — return just the final assistant text content
- **Agent selection**: Yes, via request body — caller specifies preset (e.g., 'claude-code', 'opencode'), falls back to default
- **Endpoint**: POST /api/agent
- **Timeout**: 120s default, configurable via request body
- **Authentication**: API key / Bearer token required

## Open Questions
- None remaining — all requirements clear

## Scope Boundaries
- INCLUDE: Single prompt → single response REST endpoint
- EXCLUDE: Streaming, WebSocket changes, frontend changes
