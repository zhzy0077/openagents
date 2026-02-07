export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatStatus = 'ready' | 'connecting' | 'streaming' | 'error'

export interface ChatMessagePart {
  type: 'text' | 'code' | 'image' | 'tool_call' | 'thought' | 'permission_ask'
  content: string
  language?: string
  // Tool call fields
  toolCallId?: string
  toolCallTitle?: string
  toolCallKind?: string
  toolCallStatus?: 'pending' | 'in_progress' | 'completed' | 'failed'
  toolCallLocations?: readonly string[]
  toolCallInput?: string
  toolCallOutput?: string
  // Permission ask fields
  permissionId?: string
  permissionQuestion?: string
  permissionOptions?: ReadonlyArray<{ label: string; value: string }>
  permissionDefaultOption?: string
  permissionResponse?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  parts?: readonly ChatMessagePart[]
  createdAt: Date
}

export interface Conversation {
  id: string
  title: string
  messages: readonly ChatMessage[]
  presetId: string
  cwd: string
  sessionId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TerminalMessage {
  type: 'spawn' | 'spawned' | 'stdin' | 'stdout' | 'stderr' | 'kill' | 'exit'
  command?: string
  args?: string[]
  pid?: number
  data?: string
  code?: number | null
  signal?: string
}

export type MessageConverter = (stdio: string) => string
