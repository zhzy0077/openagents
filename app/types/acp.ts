export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params: unknown
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification

export type AcpContentBlock = AcpTextContent | AcpImageContent | AcpResourceContent

export interface AcpTextContent {
  type: 'text'
  text: string
}

export interface AcpImageContent {
  type: 'image'
  mimeType: string
  data: string
}

export interface AcpResourceContent {
  type: 'resource'
  resource: {
    uri: string
    text?: string
    mimeType?: string
  }
}

// Tool call types
export type ToolCallKind = 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'think' | 'fetch' | 'other'
export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface AcpToolCall {
  toolCallId: string
  title: string
  kind: ToolCallKind
  status: ToolCallStatus
  content?: AcpContentBlock | AcpContentBlock[]
  locations?: string[]
}

// Config option types
export type ConfigOptionCategory = 'mode' | 'model' | 'thought_level' | (string & {})
export type ConfigOptionType = 'select'

export interface ConfigOptionValue {
  value: string
  name: string
  description?: string
}

export interface ConfigOption {
  id: string
  name: string
  description?: string
  category?: ConfigOptionCategory
  type: ConfigOptionType
  currentValue: string
  options: readonly ConfigOptionValue[]
}

// Plan types
export interface AcpPlanStep {
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  description?: string
}

export interface AcpPlan {
  steps: AcpPlanStep[]
}

// Permission ask types
export interface AcpPermissionOption {
  label: string
  value: string
}

export interface AcpPermissionAsk {
  permissionId: string
  question: string
  options: AcpPermissionOption[]
  defaultOption?: string
}

// Discriminated by `sessionUpdate` string field, not `type`
export type AcpSessionUpdate =
  | AcpUserMessageChunk
  | AcpAgentMessageChunk
  | AcpAgentThoughtChunk
  | AcpToolCallCreate
  | AcpToolCallUpdate
  | AcpPlanUpdate
  | AcpPermissionAskUpdate
  | AcpUsageUpdate
  | AcpAvailableCommandsUpdate
  | AcpConfigOptionsUpdate

export interface AcpUserMessageChunk {
  sessionUpdate: 'user_message_chunk'
  content: AcpContentBlock
}

export interface AcpAgentMessageChunk {
  sessionUpdate: 'agent_message_chunk'
  content: AcpContentBlock
}

export interface AcpAgentThoughtChunk {
  sessionUpdate: 'agent_thought_chunk'
  content: AcpContentBlock
}

export interface AcpToolCallCreate {
  sessionUpdate: 'tool_call'
  toolCall?: AcpToolCall
  // Flat format: tool call fields directly on the update object
  toolCallId?: string
  title?: string
  kind?: ToolCallKind
  status?: ToolCallStatus
  content?: AcpContentBlock | AcpContentBlock[]
  locations?: string[]
}

export interface AcpToolCallUpdate {
  sessionUpdate: 'tool_call_update'
  toolCall?: AcpToolCall
  // Flat format: tool call fields directly on the update object
  toolCallId?: string
  title?: string
  kind?: ToolCallKind
  status?: ToolCallStatus
  content?: AcpContentBlock | AcpContentBlock[]
  locations?: string[]
}

export interface AcpPlanUpdate {
  sessionUpdate: 'plan'
  plan: AcpPlan
}

export interface AcpPermissionAskUpdate {
  sessionUpdate: 'permission_ask'
  permissionAsk: AcpPermissionAsk
}

export interface AcpUsageUpdate {
  sessionUpdate: 'usage_update'
  used: number
  size: number
  cost: { amount: number; currency: string }
}

export interface AcpAvailableCommandsUpdate {
  sessionUpdate: 'available_commands_update'
  availableCommands: Array<{ name: string; description: string }>
}

export interface AcpConfigOptionsUpdate {
  sessionUpdate: 'config_options_update'
  configOptions: ConfigOption[]
}

export interface SessionUpdateNotification {
  jsonrpc: '2.0'
  method: 'session/update'
  params: {
    sessionId: string
    update: AcpSessionUpdate
  }
}

export interface InitializeResult {
  protocolVersion: number
  agentCapabilities: Record<string, unknown>
  agentInfo: { name: string; version: string }
  authMethods?: Array<{ id: string; name: string; description: string }>
}

export interface NewSessionResult {
  sessionId: string
  configOptions?: ConfigOption[]
  models?: {
    currentModelId: string
    availableModels: Array<{ modelId: string; name: string }>
  }
  modes?: {
    currentModeId: string
    availableModes: Array<{ id: string; name: string; description: string }>
  }
}

export interface PromptResult {
  stopReason: string
  usage: {
    totalTokens: number
    inputTokens: number
    outputTokens: number
    cachedReadTokens?: number
  }
}

export interface AcpPermissionRequestOption {
  optionId: string
  name: string
  kind: 'allow_always' | 'allow_once' | 'reject_once' | (string & {})
}

export interface AcpPermissionRequestParams {
  sessionId: string
  options: AcpPermissionRequestOption[]
  toolCall: {
    toolCallId: string
    title: string
    rawInput?: unknown
  }
}

// Type guards
export function isJsonRpcResponse(msg: unknown): msg is JsonRpcResponse {
  return typeof msg === 'object' && msg !== null && 'id' in msg && !('method' in msg)
}

export function isJsonRpcRequest(msg: unknown): msg is JsonRpcRequest {
  return typeof msg === 'object' && msg !== null && 'id' in msg && 'method' in msg
}

export function isSessionUpdateNotification(msg: unknown): msg is SessionUpdateNotification {
  return typeof msg === 'object' && msg !== null && (msg as JsonRpcNotification).method === 'session/update'
}
