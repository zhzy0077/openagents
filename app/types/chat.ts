export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatStatus = 'ready' | 'connecting' | 'streaming' | 'error'

export interface TextPart {
  type: 'text'
  content: string
}

export interface CodePart {
  type: 'code'
  content: string
  language?: string
}

export interface ImagePart {
  type: 'image'
  content: string
}

export interface ThoughtPart {
  type: 'thought'
  content: string
}

export interface ToolCallPart {
  type: 'tool_call'
  content: string
  toolCallId: string
  toolCallTitle: string
  toolCallKind: string
  toolCallStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
  toolCallLocations?: readonly string[]
  toolCallInput?: string
  toolCallOutput?: string
}

export interface PermissionAskPart {
  type: 'permission_ask'
  content: string
  permissionId: string
  permissionQuestion: string
  permissionOptions?: ReadonlyArray<{ label: string; value: string }>
  permissionDefaultOption?: string
  permissionResponse?: string
}

export type ChatMessagePart =
  | TextPart
  | CodePart
  | ImagePart
  | ThoughtPart
  | ToolCallPart
  | PermissionAskPart

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  parts?: ChatMessagePart[]
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
