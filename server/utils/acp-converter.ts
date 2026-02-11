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
} from '#shared/types/acp'
import { isSessionUpdateNotification, isJsonRpcResponse, isJsonRpcRequest } from '#shared/types/acp'
import type { ChatMessage, TextPart, ThoughtPart, ToolCallPart, PermissionAskPart } from '#shared/types/chat'

export interface AcpConverterCallbacks {
  onResponse?: (response: JsonRpcResponse) => void
  onConfigOptionsUpdate?: (configOptions: ConfigOption[]) => void
  onPermissionRequest?: (requestId: number, params: AcpPermissionRequestParams) => void
}

export class AcpConverter {
  private buffer = ''
  private messages: ChatMessage[] = []
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

  getMessages(): ChatMessage[] {
    return this.currentMessage
      ? [...this.messages, this.currentMessage]
      : [...this.messages]
  }

  getToolCalls(): ToolCallPart[] {
    return Array.from(this.toolCalls.values())
  }

  getPermissionAsks(): PermissionAskPart[] {
    return Array.from(this.permissionAsks.values())
  }

  reset(): void {
    this.buffer = ''
    this.messages = []
    this.currentMessage = null
    this.toolCalls.clear()
    this.permissionAsks.clear()
  }

  /**
   * Push the in-progress currentMessage (if any) into the finalized messages
   * array so the next turn starts with a fresh message. Called between prompt
   * turns when a JSON-RPC response signals end-of-turn.
   */
  finalizeCurrentMessage(): void {
    if (this.currentMessage) {
      this.messages.push(this.currentMessage)
      this.currentMessage = null
    }
  }

  finalize(): ChatMessage | null {
    this.finalizeCurrentMessage()
    const all = this.messages
    this.messages = []
    return all[all.length - 1] ?? null
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
      rawInput: update.rawInput,
      rawOutput: update.rawOutput,
    }
  }

  private handleMessageChunk(role: ChatMessage['role'], content: AcpContentBlock): void {
    const text = this.extractText(content)
    if (!text) return

    if (!this.currentMessage || this.currentMessage.role !== role) {
      if (this.currentMessage) {
        this.messages.push(this.currentMessage)
      }
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
      if (this.currentMessage) {
        this.messages.push(this.currentMessage)
      }
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
    // If a tool_call with this ID already exists, treat as an update instead
    // of creating a duplicate. Some agents (e.g. OpenCode) send multiple
    // tool_call (create) notifications for the same toolCallId.
    if (this.toolCalls.has(toolCall.toolCallId)) {
      this.handleToolCallUpdate(toolCall)
      return
    }

    const contentText = toolCall.content ? this.extractTextFromContentField(toolCall.content) : ''
    const rawInputText = this.stringifyRaw(toolCall.rawInput)
    const part: ToolCallPart = {
      type: 'tool_call',
      content: contentText,
      toolCallId: toolCall.toolCallId,
      toolCallTitle: toolCall.title,
      toolCallKind: toolCall.kind,
      toolCallStatus: toolCall.status,
      toolCallLocations: toolCall.locations,
      toolCallInput: rawInputText || contentText || undefined,
    }
    this.toolCalls.set(toolCall.toolCallId, part)

    // Inject into the current assistant message parts for inline rendering
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
    // Immutable replacement keeps state predictable for serialization.
    const updated: ToolCallPart = {
      ...existing,
      toolCallStatus: toolCall.status,
      toolCallTitle: toolCall.title,
      toolCallLocations: toolCall.locations,
    }

    // Populate toolCallInput from rawInput when available (e.g. OpenCode sends
    // the actual tool arguments here). Prefer rawInput over content text since
    // content is reused for output on completion.
    const rawInputText = this.stringifyRaw(toolCall.rawInput)
    if (rawInputText) {
      updated.toolCallInput = rawInputText
    }

    // Populate toolCallOutput from rawOutput when available
    const rawOutputText = this.stringifyRaw(toolCall.rawOutput)
    if (rawOutputText) {
      updated.toolCallOutput = rawOutputText
    }

    if (toolCall.content) {
      const newContent = this.extractTextFromContentField(toolCall.content)
      if (newContent) {
        updated.content = newContent
        // ACP reuses `content` for both input (on create) and output (on completion)
        if (toolCall.status === 'completed' || toolCall.status === 'failed') {
          // Only set toolCallOutput from content if rawOutput didn't already provide it
          if (!updated.toolCallOutput) {
            updated.toolCallOutput = newContent
          }
        }
      }
    }

    this.toolCalls.set(toolCall.toolCallId, updated)

    // Replace the part reference in currentMessage.parts
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

    // Inject into the current assistant message parts for inline rendering
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

  /**
   * Stringify a rawInput / rawOutput value into a human-readable string.
   * Returns an empty string when the value is nullish or an empty object.
   */
  private stringifyRaw(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && Object.keys(value as object).length === 0) return ''
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
}
