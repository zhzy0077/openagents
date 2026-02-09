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
import type { ChatMessage, ChatMessagePart, TextPart, ThoughtPart, ToolCallPart, PermissionAskPart } from '~/types/chat'

export interface AcpConverterCallbacks {
  onResponse?: (response: JsonRpcResponse) => void
  onConfigOptionsUpdate?: (configOptions: ConfigOption[]) => void
  onPermissionRequest?: (requestId: number, params: AcpPermissionRequestParams) => void
}

export class AcpConverter {
  private buffer = ''
  private currentMessage: ChatMessage | null = null
  private toolCalls = new Map<string, ToolCallPart>()
  private permissionAsks = new Map<string, PermissionAskPart>()
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

  getToolCalls(): ToolCallPart[] {
    return Array.from(this.toolCalls.values())
  }

  getPermissionAsks(): PermissionAskPart[] {
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
    const isResp = isJsonRpcResponse(msg)
    const isReq = isJsonRpcRequest(msg)
    const isNotif = isSessionUpdateNotification(msg)
    if (import.meta.dev) {
      console.log('[ACP] handleMessage:', JSON.stringify(msg).slice(0, 300), { isResp, isReq, isNotif })
    }

    if (isResp) {
      this.callbacks.onResponse?.(msg)
      return
    }

    if (isReq) {
      this.handleRequest(msg)
      return
    }

    if (isNotif) {
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
      if (import.meta.dev) {
        console.log('[ACP] permission request received:', permissionAsk)
      }
      this.handlePermissionAsk(permissionAsk)
      if (import.meta.dev) {
        console.log('[ACP] permissionAsks map size after handlePermissionAsk:', this.permissionAsks.size)
      }
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
      case 'tool_call': {
        const toolCall = this.extractToolCall(update)
        if (toolCall) this.handleToolCallCreate(toolCall)
        break
      }
      case 'tool_call_update': {
        const toolCall = this.extractToolCall(update)
        if (toolCall) this.handleToolCallUpdate(toolCall)
        break
      }
      case 'permission_ask':
        this.handlePermissionAsk(update.permissionAsk)
        break
      case 'config_options_update':
        this.callbacks.onConfigOptionsUpdate?.(update.configOptions)
        break
    }
  }

  private extractToolCall(update: AcpToolCallCreate | AcpToolCallUpdate): AcpToolCall | null {
    if (update.toolCall) return update.toolCall
    if (!update.toolCallId) {
      console.warn('ACP tool call update missing both toolCall and toolCallId, skipping')
      return null
    }
    return {
      toolCallId: update.toolCallId,
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
        parts: [{ type: 'text', content: text } satisfies TextPart],
        createdAt: new Date(),
      }
    } else {
      this.currentMessage.content += text
      const parts = this.currentMessage.parts ?? []
      const lastPart = parts[parts.length - 1]
      if (lastPart?.type === 'text') {
        lastPart.content += text
      } else {
        parts.push({ type: 'text', content: text } satisfies TextPart)
      }
      this.currentMessage.parts = parts
    }
  }

  private handleAgentThoughtChunk(content: AcpContentBlock): void {
    const text = this.extractText(content)
    if (!text) return

    this.ensureCurrentAssistantMessage()

    const parts = this.currentMessage!.parts ?? []
    const existingThought = parts.find((p): p is ThoughtPart => p.type === 'thought')
    if (existingThought) {
      existingThought.content += text
    } else {
      parts.push({ type: 'thought', content: text } satisfies ThoughtPart)
    }
    this.currentMessage!.parts = parts
  }

  private ensureCurrentAssistantMessage(): void {
    if (!this.currentMessage || this.currentMessage.role !== 'assistant') {
      this.currentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        parts: [],
        createdAt: new Date(),
      }
    }
  }

  private handleToolCallCreate(toolCall: AcpToolCall): void {
    const contentText = toolCall.content ? this.extractTextFromContentField(toolCall.content) : ''
    const part: ToolCallPart = {
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

    // Also inject into the current assistant message parts for inline rendering
    this.ensureCurrentAssistantMessage()
    const parts = this.currentMessage!.parts ?? []
    parts.push(part)
    this.currentMessage!.parts = parts
  }

  private handleToolCallUpdate(toolCall: AcpToolCall): void {
    const existing = this.toolCalls.get(toolCall.toolCallId)
    if (!existing) {
      this.handleToolCallCreate(toolCall)
      return
    }

    // Build a replacement object instead of mutating in-place.
    // Vue reactivity tracks object identity — mutating the same reference
    // won't trigger re-renders when the parts array is spread-copied.
    const updated: ToolCallPart = {
      ...existing,
      toolCallStatus: toolCall.status,
      toolCallTitle: toolCall.title,
      toolCallLocations: toolCall.locations,
    }

    if (toolCall.content) {
      const newContent = this.extractTextFromContentField(toolCall.content)
      if (newContent) {
        updated.content = newContent
        // ACP reuses `content` for both input (on create) and output (on completion)
        if (toolCall.status === 'completed' || toolCall.status === 'failed') {
          updated.toolCallOutput = newContent
        }
      }
    }

    this.toolCalls.set(toolCall.toolCallId, updated)

    // Replace the part reference in currentMessage.parts so Vue detects the change
    if (this.currentMessage?.parts) {
      const idx = this.currentMessage.parts.indexOf(existing)
      if (idx !== -1) {
        this.currentMessage.parts[idx] = updated
      }
    }
  }

  private handlePermissionAsk(permissionAsk: AcpPermissionAsk): void {
    const part: PermissionAskPart = {
      type: 'permission_ask',
      content: permissionAsk.question,
      permissionId: permissionAsk.permissionId,
      permissionQuestion: permissionAsk.question,
      permissionOptions: permissionAsk.options,
      permissionDefaultOption: permissionAsk.defaultOption,
    }
    this.permissionAsks.set(permissionAsk.permissionId, part)

    // Also inject into the current assistant message parts for inline rendering
    this.ensureCurrentAssistantMessage()
    const parts = this.currentMessage!.parts ?? []
    parts.push(part)
    this.currentMessage!.parts = parts
  }

  private extractText(content: AcpContentBlock): string {
    return content.type === 'text' ? content.text : ''
  }

  private extractTextFromContentField(content: AcpContentBlock | AcpContentBlock[] | unknown): string {
    if (Array.isArray(content)) {
      return content
        .map(block => this.unwrapContentBlock(block))
        .filter((block): block is Extract<AcpContentBlock, { type: 'text' }> => block.type === 'text')
        .map(block => block.text)
        .join('')
    }
    const unwrapped = this.unwrapContentBlock(content)
    return unwrapped.type === 'text' ? unwrapped.text : ''
  }

  /**
   * Some ACP agents (e.g. Claude Code) wrap content blocks in an extra layer:
   *   { type: "content", content: { type: "text", text: "..." } }
   * This unwraps that layer, returning the inner AcpContentBlock.
   */
  private unwrapContentBlock(block: unknown): AcpContentBlock {
    if (
      typeof block === 'object' && block !== null
      && 'type' in block && (block as Record<string, unknown>).type === 'content'
      && 'content' in block && typeof (block as Record<string, unknown>).content === 'object'
    ) {
      return (block as { content: AcpContentBlock }).content
    }
    return block as AcpContentBlock
  }
}
