/**
 * WebSocket Message Protocol Contract
 *
 * Defines structured message types for bidirectional communication between
 * browser client and WebSocket server. Replaces ad-hoc stdout/stderr with
 * semantically explicit ACP-aware message types.
 *
 * Messages use discriminated unions keyed on the `type` field for
 * exhaustive pattern matching.
 */

import type {
  ChatMessage,
  ToolCallPart,
  PermissionAskPart,
} from '#shared/types/chat'
import type {
  ConfigOption,
} from '#shared/types/acp'

// ============================================================================
// SERVER -> CLIENT MESSAGES
// ============================================================================

/**
 * Spawned: Process successfully created with PID
 */
export interface SpawnedMessage {
  type: 'spawned'
  pid: number
}

/**
 * Exit: Process terminated with exit code and/or signal
 */
export interface ExitMessage {
  type: 'exit'
  code: number | null
  signal: string | null
}

/**
 * Error: Transport or process error (non-exit)
 */
export interface ErrorMessage {
  type: 'error'
  message: string
}

/**
 * ACP Message Chunk: Streamed ChatMessage snapshot
 *
 * Emitted when a new message chunk arrives from the agent (text, code, etc).
 * The `message` is a complete ChatMessage snapshot at that point in the stream.
 */
export interface AcpMessageChunkMessage {
  type: 'acp:message_chunk'
  message: ChatMessage
}

/**
 * ACP Tool Call: Tool invocation created or updated
 *
 * Represents a single tool call with current status and details.
 */
export interface AcpToolCallMessage {
  type: 'acp:tool_call'
  toolCall: ToolCallPart
}

/**
 * ACP Permission Request: Agent requesting user approval
 *
 * Sent when the agent asks for permission to execute a tool.
 * Client responds via `permission_response` ClientMessage.
 */
export interface AcpPermissionRequestMessage {
  type: 'acp:permission_request'
  permissionAsk: PermissionAskPart
}

/**
 * ACP Response: JSON-RPC response from agent
 *
 * Forwarded JSON-RPC 2.0 response (result or error).
 */
export interface AcpResponseMessage {
  type: 'acp:response'
  id: number | string
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/**
 * ACP Config Update: Configuration options changed
 *
 * Sent when the agent provides or updates available config options
 * (e.g., model selection, thinking level).
 */
export interface AcpConfigUpdateMessage {
  type: 'acp:config_update'
  options: ConfigOption[]
}

/**
 * ACP Finalized: Stream end, final message available
 *
 * Emitted when:
 * - Agent response completes (end of session/prompt)
 * - Session ends abnormally
 *
 * The `message` is the final ChatMessage snapshot, or null if no message
 * was produced (e.g., error before any output).
 */
export interface AcpFinalizedMessage {
  type: 'acp:finalized'
  message: ChatMessage | null
}

/**
 * Discriminated union of all ServerMessages
 *
 * Use type guards or exhaustive switch statements:
 *
 * ```ts
 * const msg: ServerMessage = JSON.parse(event.data)
 * switch (msg.type) {
 *   case 'spawned': return handle(msg.pid)
 *   case 'acp:message_chunk': return handle(msg.message)
 *   ...
 * }
 * ```
 */
export type ServerMessage =
  | SpawnedMessage
  | ExitMessage
  | ErrorMessage
  | AcpMessageChunkMessage
  | AcpToolCallMessage
  | AcpPermissionRequestMessage
  | AcpResponseMessage
  | AcpConfigUpdateMessage
  | AcpFinalizedMessage

// ============================================================================
// CLIENT -> SERVER MESSAGES
// ============================================================================

/**
 * Spawn: Create a new process
 *
 * Creates a child process with the given command and environment.
 * Server responds with `spawned` or `error`.
 */
export interface SpawnClientMessage {
  type: 'spawn'
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  image?: string
}

/**
 * Stdin: Send raw data to process stdin
 *
 * Raw JSON-RPC 2.0 message (newline-delimited).
 * Server pipes directly to child process stdin.
 */
export interface StdinClientMessage {
  type: 'stdin'
  data: string
}

/**
 * Kill: Terminate the process
 *
 * Sends signal to the process. Defaults to SIGTERM.
 * Server responds with `exit` when process terminates.
 */
export interface KillClientMessage {
  type: 'kill'
  signal?: string
}

/**
 * Permission Response: User approves/denies agent action
 *
 * Client responds to a preceding `acp:permission_request`.
 * The `optionId` must match one of the options from the request.
 */
export interface PermissionResponseClientMessage {
  type: 'permission_response'
  permissionId: string
  optionId: string
}

/**
 * Discriminated union of all ClientMessages
 *
 * Use type guards or exhaustive switch statements.
 */
export type ClientMessage =
  | SpawnClientMessage
  | StdinClientMessage
  | KillClientMessage
  | PermissionResponseClientMessage


