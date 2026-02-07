import type { ChatMessage, ChatStatus, ChatMessagePart } from '~/types/chat'
import type { JsonRpcResponse, NewSessionResult, ConfigOption, InitializeResult } from '~/types/acp'
import { acpConverter } from '~/utils/messageConverter'

export interface UseChatOptions {
  onUserMessage?: (message: ChatMessage) => void
  onAssistantMessage?: (message: ChatMessage) => void
  onSessionReady?: (sessionId: string) => void
}

interface ChatStartOptions {
  cwd: string
  presetId?: string
  sessionId?: string | null
}

function supportsLoadSession(result: unknown): boolean {
  const initialize = result as InitializeResult
  return Boolean((initialize.agentCapabilities as { loadSession?: boolean } | undefined)?.loadSession)
}

export function useChat(options: UseChatOptions = {}) {
  const messages = ref<ChatMessage[]>([])
  const status = ref<ChatStatus>('ready')
  const input = ref('')
  const currentStreamingMessage = ref<ChatMessage | null>(null)
  const toolCalls = ref<ChatMessagePart[]>([])
  const permissionAsks = ref<ChatMessagePart[]>([])
  const configOptions = ref<ConfigOption[]>([])
  let nextRequestId = 1
  let sessionId: string | null = null
  let pendingPromptId: number | null = null
  let initializeRequestId: number | null = null
  let newSessionRequestId: number | null = null
  let loadSessionRequestId: number | null = null
  let pendingSessionToLoad: string | null = null
  let canLoadSession = false
  const pendingConfigRequestIds = new Set<number>()
  const permissionRequestIds = new Map<string, number>()
  let sessionCwd = '.'

  const sendJsonRpc = (method: string, params: unknown): number => {
    const id = nextRequestId++
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
    sendStdinRef(message)
    return id
  }

  const handleAcpResponse = (response: JsonRpcResponse) => {
    if (response.error) {
      if (response.id === loadSessionRequestId) {
        loadSessionRequestId = null
        sessionId = null
        newSessionRequestId = sendJsonRpc('session/new', { cwd: sessionCwd, mcpServers: [] })
        status.value = 'connecting'
        return
      }
      console.error('ACP error:', response.error)
      status.value = 'error'
      return
    }

    if (response.id === initializeRequestId) {
      initializeRequestId = null
      canLoadSession = supportsLoadSession(response.result)

      if (pendingSessionToLoad && canLoadSession) {
        sessionId = pendingSessionToLoad
        loadSessionRequestId = sendJsonRpc('session/load', {
          sessionId: pendingSessionToLoad,
          cwd: sessionCwd,
          mcpServers: [],
        })
      } else {
        newSessionRequestId = sendJsonRpc('session/new', { cwd: sessionCwd, mcpServers: [] })
      }
      pendingSessionToLoad = null
    } else if (response.id === newSessionRequestId) {
      newSessionRequestId = null
      const result = response.result as NewSessionResult
      sessionId = result.sessionId
      if (result.configOptions) {
        configOptions.value = result.configOptions
      }
      options.onSessionReady?.(result.sessionId)
      status.value = 'ready'
    } else if (response.id === loadSessionRequestId) {
      loadSessionRequestId = null
      acpConverter.finalize()
      currentStreamingMessage.value = null
      if (sessionId) {
        options.onSessionReady?.(sessionId)
      }
      status.value = 'ready'
    } else if (response.id === pendingPromptId) {
      const finalizedMessage = currentStreamingMessage.value
      acpConverter.finalize()
      if (finalizedMessage) {
        options.onAssistantMessage?.(finalizedMessage)
      }
      currentStreamingMessage.value = null
      pendingPromptId = null
      status.value = 'ready'
    } else if (pendingConfigRequestIds.has(response.id)) {
      pendingConfigRequestIds.delete(response.id)
      const result = response.result as { configOptions?: ConfigOption[] }
      if (result?.configOptions) {
        configOptions.value = result.configOptions
      }
    }
  }

  acpConverter.setCallbacks({
    onResponse: handleAcpResponse,
    onConfigOptionsUpdate: (options) => {
      configOptions.value = options
    },
    onPermissionRequest: (requestId, _params) => {
      permissionRequestIds.set(String(requestId), requestId)
      updateFromConverter()
    },
  })

  let sendStdinRef: (data: string) => void = () => {}

  const updateFromConverter = () => {
    const msg = acpConverter.getCurrentMessage()
    if (msg) {
      if (currentStreamingMessage.value?.id === msg.id) {
        currentStreamingMessage.value.content = msg.content
        currentStreamingMessage.value.parts = msg.parts
      } else {
        currentStreamingMessage.value = msg
        messages.value.push(msg)
      }
      toolCalls.value = acpConverter.getToolCalls()
      permissionAsks.value = acpConverter.getPermissionAsks()
      if (pendingPromptId !== null) {
        status.value = 'streaming'
      }
    }
  }

  const { status: wsStatus, sendStdin, spawn, kill } = useProcess({
    autoSpawn: false,
    onSpawned: () => {
      nextRequestId = 1
      sessionId = null
      pendingPromptId = null
      initializeRequestId = null
      newSessionRequestId = null
      loadSessionRequestId = null
      pendingSessionToLoad = null
      canLoadSession = false
      pendingConfigRequestIds.clear()
      permissionRequestIds.clear()
      configOptions.value = []
      acpConverter.reset()
      currentStreamingMessage.value = null
      status.value = 'connecting'
      initializeRequestId = sendJsonRpc('initialize', { protocolVersion: 1, clientCapabilities: {} })
    },
    onStdout: (data: string) => {
      acpConverter.process(data)
      updateFromConverter()
    },
    onStderr: (data: string) => {
      acpConverter.process(data)
      updateFromConverter()
    },
    onExit: () => {
      acpConverter.finalize()
      currentStreamingMessage.value = null
      sessionId = null
      status.value = 'ready'
    },
    onError: (error: Error) => {
      console.error('WebSocket error:', error)
      status.value = 'error'
      currentStreamingMessage.value = null
    }
  })

  sendStdinRef = sendStdin

  watch(wsStatus, (newStatus) => {
    if (newStatus === 'connecting') {
      status.value = 'connecting'
    } else if (newStatus === 'error') {
      status.value = 'error'
    }
  })

  const sendMessage = (content: string) => {
    if (!content.trim() || status.value === 'streaming' || !sessionId) {
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      createdAt: new Date()
    }
    messages.value.push(userMessage)
    options.onUserMessage?.(userMessage)

    currentStreamingMessage.value = null
    pendingPromptId = sendJsonRpc('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: content.trim() }]
    })

    input.value = ''
    status.value = 'streaming'
  }

  const stop = () => {
    kill()
    currentStreamingMessage.value = null
    pendingPromptId = null
  }

  const clear = () => {
    messages.value = []
    currentStreamingMessage.value = null
    toolCalls.value = []
    permissionAsks.value = []
    configOptions.value = []
    acpConverter.reset()
    sessionId = null
    pendingPromptId = null
    initializeRequestId = null
    newSessionRequestId = null
    loadSessionRequestId = null
    pendingSessionToLoad = null
    canLoadSession = false
    pendingConfigRequestIds.clear()
    permissionRequestIds.clear()
    sessionCwd = '.'
    nextRequestId = 1
    status.value = 'ready'
  }

  const start = (options: ChatStartOptions) => {
    clear()
    sessionCwd = options.cwd
    pendingSessionToLoad = options.sessionId ?? null
    spawn(options.presetId)
  }

  const respondToPermission = (permissionId: string, response: string) => {
    acpConverter.respondToPermission(permissionId, response)

    const requestId = permissionRequestIds.get(permissionId)
    let responseMessage: string
    if (requestId !== undefined) {
      permissionRequestIds.delete(permissionId)
      responseMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          outcome: { outcome: 'selected', optionId: response },
        },
      }) + '\n'
    } else {
      responseMessage = JSON.stringify({
        jsonrpc: '2.0',
        method: 'permission/response',
        params: { permissionId, response },
      }) + '\n'
    }
    sendStdin(responseMessage)

    permissionAsks.value = acpConverter.getPermissionAsks()
  }

  const setConfigOption = (configId: string, value: string) => {
    if (!sessionId) return
    const requestId = sendJsonRpc('session/set_config_option', {
      sessionId,
      configId,
      value,
    })
    pendingConfigRequestIds.add(requestId)
  }

  return {
    messages: readonly(messages),
    status: readonly(status),
    input,
    toolCalls: readonly(toolCalls),
    permissionAsks: readonly(permissionAsks),
    configOptions: readonly(configOptions),
    sendMessage,
    stop,
    clear,
    start,
    respondToPermission,
    setConfigOption,
  }
}
