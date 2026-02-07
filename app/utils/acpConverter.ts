import type {
  AcpContentBlock,
  AcpSessionUpdate,
  AcpToolCall,
  AcpToolCallCreate,
  AcpToolCallUpdate,
  AcpPermissionAsk,
  AcpPermissionRequestParams,
  JsonRpcRequest,
  JsonRpcResponse,
  ConfigOption,
} from '~/types/acp'
import { isSessionUpdateNotification, isJsonRpcResponse, isJsonRpcRequest } from '~/types/acp'
import type { ChatMessage, ChatMessagePart } from '~/types/chat'

export interface AcpConverterCallbacks {
  onResponse?: (response: JsonRpcResponse) => void
  onConfigOptionsUpdate?: (configOptions: ConfigOption[]) => void
  onPermissionRequest?: (requestId: number, params: AcpPermissionRequestParams) => void
}

export class AcpConverter {
  private buffer = ''
  private currentMessage: ChatMessage | null = null
  private toolCalls = new Map<string, ChatMessagePart>()
  private permissionAsks = new Map<string, ChatMessagePart>()
  private callbacks: AcpConverterCallbacks = {}

  setCallbacks(callbacks: AcpConverterCallbacks): void {
    this.callbacks = callbacks
  }

  process(data: string): void {
    this.buffer += data

    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const msg = JSON.parse(line)
        this.handleMessage(msg)
      } catch (error) {
        console.warn('Failed to parse ACP message:', line, error)
      }
    }
  }

  getCurrentMessage(): ChatMessage | null {
    return this.currentMessage
  }

  getToolCalls(): ChatMessagePart[] {
    return Array.from(this.toolCalls.values())
  }

  getPermissionAsks(): ChatMessagePart[] {
    return Array.from(this.permissionAsks.values())
  }

  reset(): void {
    this.buffer = ''
    this.currentMessage = null
    this.toolCalls.clear()
    this.permissionAsks.clear()
  }

  finalize(): ChatMessage | null {
    const msg = this.currentMessage
    this.currentMessage = null
    return msg
  }

  respondToPermission(permissionId: string, response: string): void {
    const ask = this.permissionAsks.get(permissionId)
    if (ask) {
      ask.permissionResponse = response
      this.permissionAsks.delete(permissionId)
    }
  }

  private handleMessage(msg: unknown): void {
    if (isJsonRpcResponse(msg)) {
      this.callbacks.onResponse?.(msg)
      return
    }

    if (isJsonRpcRequest(msg)) {
      this.handleRequest(msg)
      return
    }

    if (isSessionUpdateNotification(msg)) {
      this.handleSessionUpdate(msg.params.update)
    }
  }

  private handleRequest(request: JsonRpcRequest): void {
    if (request.method === 'session/request_permission') {
      const params = request.params as AcpPermissionRequestParams
      const permissionAsk: AcpPermissionAsk = {
        permissionId: String(request.id),
        question: params.toolCall.title,
        options: params.options.map(o => ({ label: o.name, value: o.optionId })),
      }
      this.handlePermissionAsk(permissionAsk)
      this.callbacks.onPermissionRequest?.(request.id, params)
    }
  }

  private handleSessionUpdate(update: AcpSessionUpdate): void {
    switch (update.sessionUpdate) {
      case 'user_message_chunk':
        this.handleMessageChunk('user', update.content)
        break
      case 'agent_message_chunk':
        this.handleMessageChunk('assistant', update.content)
        break
      case 'agent_thought_chunk':
        this.handleAgentThoughtChunk(update.content)
        break
      case 'tool_call':
        this.handleToolCallCreate(this.extractToolCall(update))
        break
      case 'tool_call_update':
        this.handleToolCallUpdate(this.extractToolCall(update))
        break
      case 'permission_ask':
        this.handlePermissionAsk(update.permissionAsk)
        break
      case 'config_options_update':
        this.callbacks.onConfigOptionsUpdate?.(update.configOptions)
        break
    }
  }

  private extractToolCall(update: AcpToolCallCreate | AcpToolCallUpdate): AcpToolCall {
    if (update.toolCall) return update.toolCall
    return {
      toolCallId: update.toolCallId!,
      title: update.title ?? '',
      kind: update.kind ?? 'other',
      status: update.status ?? 'pending',
      content: update.content,
      locations: update.locations,
    }
  }

  private handleMessageChunk(role: ChatMessage['role'], content: AcpContentBlock): void {
    const text = this.extractText(content)
    if (!text) return

    if (!this.currentMessage || this.currentMessage.role !== role) {
      this.currentMessage = {
        id: crypto.randomUUID(),
        role,
        content: text,
        parts: [{ type: 'text', content: text }],
        createdAt: new Date(),
      }
    } else {
      this.currentMessage.content += text
      const parts = (this.currentMessage.parts ?? []) as ChatMessagePart[]
      const lastPart = parts[parts.length - 1]
      if (lastPart?.type === 'text') {
        lastPart.content += text
      } else {
        parts.push({ type: 'text', content: text })
      }
      this.currentMessage.parts = parts
    }
  }

  private handleAgentThoughtChunk(content: AcpContentBlock): void {
    const text = this.extractText(content)
    if (!text) return

    if (!this.currentMessage) {
      this.currentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        parts: [],
        createdAt: new Date(),
      }
    }

    const parts = (this.currentMessage.parts ?? []) as ChatMessagePart[]
    const existingThought = parts.find(p => p.type === 'thought')
    if (existingThought) {
      existingThought.content += text
    } else {
      parts.push({ type: 'thought', content: text })
    }
    this.currentMessage.parts = parts
  }

  private handleToolCallCreate(toolCall: AcpToolCall): void {
    const contentText = toolCall.content ? this.extractTextFromContentField(toolCall.content) : ''
    const part: ChatMessagePart = {
      type: 'tool_call',
      content: contentText,
      toolCallId: toolCall.toolCallId,
      toolCallTitle: toolCall.title,
      toolCallKind: toolCall.kind,
      toolCallStatus: toolCall.status,
      toolCallLocations: toolCall.locations,
      toolCallInput: contentText || undefined,
    }
    this.toolCalls.set(toolCall.toolCallId, part)
  }

  private handleToolCallUpdate(toolCall: AcpToolCall): void {
    const existing = this.toolCalls.get(toolCall.toolCallId)
    if (!existing) {
      this.handleToolCallCreate(toolCall)
      return
    }

    existing.toolCallStatus = toolCall.status
    existing.toolCallTitle = toolCall.title
    existing.toolCallLocations = toolCall.locations

    if (toolCall.content) {
      const newContent = this.extractTextFromContentField(toolCall.content)
      if (newContent) {
        existing.content = newContent
        // ACP reuses `content` for both input (on create) and output (on completion)
        if (toolCall.status === 'completed' || toolCall.status === 'failed') {
          existing.toolCallOutput = newContent
        }
      }
    }
  }

  private handlePermissionAsk(permissionAsk: AcpPermissionAsk): void {
    const part: ChatMessagePart = {
      type: 'permission_ask',
      content: permissionAsk.question,
      permissionId: permissionAsk.permissionId,
      permissionQuestion: permissionAsk.question,
      permissionOptions: permissionAsk.options,
      permissionDefaultOption: permissionAsk.defaultOption,
    }
    this.permissionAsks.set(permissionAsk.permissionId, part)
  }

  private extractText(content: AcpContentBlock): string {
    return content.type === 'text' ? content.text : ''
  }

  private extractTextFromContentField(content: AcpContentBlock | AcpContentBlock[]): string {
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('')
    }
    return this.extractText(content)
  }
}
