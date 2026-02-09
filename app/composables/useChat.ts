import type { ChatMessage, ChatStatus, ToolCallPart, PermissionAskPart } from '~/types/chat'
import type {
  JsonRpcResponse,
  NewSessionResult,
  ConfigOption,
  InitializeResult,
  ListSessionsResult,
  SessionInfo,
  AcpPermissionRequestParams,
} from '~/types/acp'
import { AcpConverter } from '~/utils/acpConverter'

export interface UseChatOptions {
  onUserMessage?: (message: ChatMessage) => void
  onAssistantMessage?: (message: ChatMessage) => void
  onSessionReady?: (sessionId: string) => void
  onSessionTitle?: (sessionId: string, title: string) => void
}

interface ChatStartOptions {
  cwd: string
  presetId?: string
  sessionId?: string | null
}

function supportsLoadSession(result: unknown): boolean {
  const initialize = result as InitializeResult
  return Boolean(initialize.agentCapabilities?.loadSession)
}

function supportsSessionList(result: unknown): boolean {
  const initialize = result as InitializeResult
  return Boolean(initialize.agentCapabilities?.sessionCapabilities?.list)
}

function findSessionById(result: unknown, targetSessionId: string): SessionInfo | null {
  const listResult = result as ListSessionsResult
  if (!Array.isArray(listResult.sessions)) {
    return null
  }

  const session = listResult.sessions.find(
    entry => typeof entry?.sessionId === 'string' && entry.sessionId === targetSessionId,
  )

  return session ?? null
}

function buildConfigOptions(result: NewSessionResult): ConfigOption[] {
  const opts: ConfigOption[] = result.configOptions ? [...result.configOptions] : []

  if (result.models && !opts.some(o => o.category === 'model')) {
    opts.push({
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: result.models.currentModelId,
      options: result.models.availableModels.map(m => ({ value: m.modelId, name: m.name })),
    })
  }

  if (result.modes && !opts.some(o => o.category === 'mode')) {
    opts.push({
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: result.modes.currentModeId,
      options: result.modes.availableModes.map(m => ({ value: m.id, name: m.name })),
    })
  }

  return opts
}

export function useChat(chatOptions: UseChatOptions = {}) {
  const { settings } = useSettings()
  const messages = ref<ChatMessage[]>([])
  const status = ref<ChatStatus>('ready')
  const input = ref('')
  const currentStreamingMessage = ref<ChatMessage | null>(null)
  const toolCalls = ref<ToolCallPart[]>([])
  const permissionAsks = ref<PermissionAskPart[]>([])
  const configOptions = ref<ConfigOption[]>([])
  const acpConverter = new AcpConverter()
  let nextRequestId = 1
  let sessionId: string | null = null
  let pendingPromptId: number | null = null
  let initializeRequestId: number | null = null
  let newSessionRequestId: number | null = null
  let loadSessionRequestId: number | null = null
  let listSessionsRequestId: number | null = null
  let preloadListRequestId: number | null = null
  let pendingSessionToLoad: string | null = null
  let canLoadSession = false
  let canListSessions = false
  let isSpawning = false
  const pendingConfigRequestIds = new Set<number>()
  const permissionRequestIds = new Map<string, number>()
  let sessionCwd = '.'

  /** Resets protocol-level state shared between clear() and onSpawned. */
  const resetProtocolState = () => {
    nextRequestId = 1
    sessionId = null
    pendingPromptId = null
    initializeRequestId = null
    newSessionRequestId = null
    loadSessionRequestId = null
    listSessionsRequestId = null
    preloadListRequestId = null
    canLoadSession = false
    canListSessions = false
    pendingConfigRequestIds.clear()
    permissionRequestIds.clear()
    configOptions.value = []
    acpConverter.reset()
    currentStreamingMessage.value = null
  }

  const sendJsonRpc = (method: string, params: unknown): number => {
    const id = nextRequestId++
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
    sendStdinRef(message)
    return id
  }

  const sendJsonRpcResponse = (id: number, result: unknown): void => {
    const message = JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'
    sendStdinRef(message)
  }

  const sendJsonRpcNotification = (method: string, params: unknown): void => {
    const message = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n'
    sendStdinRef(message)
  }

  const requestSessionList = () => {
    if (!sessionId || !canListSessions || listSessionsRequestId !== null) {
      return
    }

    listSessionsRequestId = sendJsonRpc('session/list', {})
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
      if (pendingConfigRequestIds.has(response.id)) {
        pendingConfigRequestIds.delete(response.id)
        console.warn('Config option error:', response.error)
        return
      }
      if (response.id === listSessionsRequestId) {
        listSessionsRequestId = null
        if (response.error.code === -32601) {
          canListSessions = false
        }
        return
      }
      if (response.id === preloadListRequestId) {
        preloadListRequestId = null
        // List failed — try loading with stored cwd as fallback
        if (pendingSessionToLoad && canLoadSession) {
          sessionId = pendingSessionToLoad
          pendingSessionToLoad = null
          loadSessionRequestId = sendJsonRpc('session/load', {
            sessionId: sessionId,
            cwd: sessionCwd,
            mcpServers: [],
          })
        } else {
          pendingSessionToLoad = null
          newSessionRequestId = sendJsonRpc('session/new', { cwd: sessionCwd, mcpServers: [] })
        }
        return
      }
      console.error('ACP error:', response.error)
      status.value = 'error'
      return
    }

    if (response.id === initializeRequestId) {
      initializeRequestId = null
      canLoadSession = supportsLoadSession(response.result)
      canListSessions = supportsSessionList(response.result)

      if (pendingSessionToLoad && canLoadSession) {
        if (canListSessions) {
          // Call session/list first to discover the correct cwd for the session.
          // The agent resolves cwd internally and may differ from sessionCwd.
          preloadListRequestId = sendJsonRpc('session/list', {})
        } else {
          // Agent doesn't support list — fall back to stored cwd
          sessionId = pendingSessionToLoad
          loadSessionRequestId = sendJsonRpc('session/load', {
            sessionId: pendingSessionToLoad,
            cwd: sessionCwd,
            mcpServers: [],
          })
          pendingSessionToLoad = null
        }
      } else {
        pendingSessionToLoad = null
        newSessionRequestId = sendJsonRpc('session/new', { cwd: sessionCwd, mcpServers: [] })
      }
    } else if (response.id === newSessionRequestId) {
      newSessionRequestId = null
      const result = response.result as NewSessionResult
      sessionId = result.sessionId
      configOptions.value = buildConfigOptions(result)
      chatOptions.onSessionReady?.(result.sessionId)
      requestSessionList()
      status.value = 'ready'
    } else if (response.id === loadSessionRequestId) {
      loadSessionRequestId = null
      // Flush the last replayed message before finalizing — in case the final
      // session_update and the session/load response arrived in the same chunk,
      // updateFromConverter() hasn't been called yet for that message.
      updateFromConverter()
      acpConverter.finalize()
      currentStreamingMessage.value = null
      if (sessionId) {
        chatOptions.onSessionReady?.(sessionId)
        requestSessionList()
      }
      status.value = 'ready'
    } else if (response.id === listSessionsRequestId) {
      listSessionsRequestId = null
      if (sessionId) {
        const session = findSessionById(response.result, sessionId)
        const title = typeof session?.title === 'string' ? session.title.trim() : ''
        if (title.length > 0) {
          chatOptions.onSessionTitle?.(sessionId, title)
        }
      }
    } else if (response.id === preloadListRequestId) {
      preloadListRequestId = null
      const targetSessionId = pendingSessionToLoad
      pendingSessionToLoad = null

      if (targetSessionId) {
        const session = findSessionById(response.result, targetSessionId)
        if (session) {
          sessionId = targetSessionId
          loadSessionRequestId = sendJsonRpc('session/load', {
            sessionId: targetSessionId,
            cwd: session.cwd,
            mcpServers: [],
          })
        } else {
          // Session not found in list — start a new session
          newSessionRequestId = sendJsonRpc('session/new', { cwd: sessionCwd, mcpServers: [] })
        }
      } else {
        newSessionRequestId = sendJsonRpc('session/new', { cwd: sessionCwd, mcpServers: [] })
      }
    } else if (response.id === pendingPromptId) {
      const finalizedMessage = currentStreamingMessage.value
      acpConverter.finalize()
      if (finalizedMessage) {
        chatOptions.onAssistantMessage?.(finalizedMessage)
      }
      currentStreamingMessage.value = null
      pendingPromptId = null
      requestSessionList()
      status.value = 'ready'
    } else if (pendingConfigRequestIds.has(response.id)) {
      pendingConfigRequestIds.delete(response.id)
      const result = response.result as NewSessionResult
      if (result) {
        const updated = buildConfigOptions(result)
        if (updated.length > 0) {
          configOptions.value = updated
        }
      }
    }
  }

  acpConverter.setCallbacks({
    onResponse: handleAcpResponse,
    onConfigOptionsUpdate: (newConfigOptions) => {
      configOptions.value = newConfigOptions
    },
    onPermissionRequest: (requestId, params: AcpPermissionRequestParams) => {
      permissionRequestIds.set(String(requestId), requestId)
      updateFromConverter()

      // Auto-allow: immediately respond without showing UI
      if (settings.value.permissionMode === 'always-allow') {
        const allowOption = params.options.find(o => o.kind === 'allow_once' || o.kind === 'allow_always')
        const optionId = allowOption?.optionId ?? params.options[0]?.optionId
        if (optionId) {
          respondToPermission(String(requestId), optionId)
        }
      }
    },
  })

  let sendStdinRef: (data: string) => void = () => {}

  const updateFromConverter = () => {
    const msg = acpConverter.getCurrentMessage()
    if (msg) {
      if (currentStreamingMessage.value?.id === msg.id) {
        currentStreamingMessage.value.content = msg.content
        // Reassign parts to trigger Vue reactivity for inline tool call / permission updates
        currentStreamingMessage.value.parts = msg.parts ? [...msg.parts] : msg.parts
      } else {
        currentStreamingMessage.value = msg
        messages.value.push(msg)
      }
      if (pendingPromptId !== null) {
        status.value = 'streaming'
      }
    }

    // Keep internal refs in sync for reactivity triggers and permission response lookup.
    // Tool calls and permission asks are now also embedded in message parts for inline rendering.
    toolCalls.value = acpConverter.getToolCalls()
    const newPermissionAsks = acpConverter.getPermissionAsks()
    if (import.meta.dev) {
      console.log('[useChat] updateFromConverter - permissionAsks count:', newPermissionAsks.length, 'msg exists:', !!msg)
    }
    permissionAsks.value = newPermissionAsks
  }

  const { status: wsStatus, sendStdin, spawn, kill } = useAgentProcess({
    autoSpawn: false,
    onSpawned: () => {
      isSpawning = false
      resetProtocolState()
      // NOTE: Do NOT reset pendingSessionToLoad here — start() sets it before spawn(),
      // and resetting it here would prevent session/load from ever firing.
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
      // Ignore stale exit events from the old process being killed during a respawn.
      // The server kills the old process when a new spawn() arrives, and the exit
      // event may arrive after the new onSpawned — without this guard it would
      // clobber the freshly-initialized session state.
      if (isSpawning) return

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
    chatOptions.onUserMessage?.(userMessage)

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
    toolCalls.value = []
    permissionAsks.value = []
    resetProtocolState()
    pendingSessionToLoad = null
    isSpawning = false
    sessionCwd = '.'
    status.value = 'ready'
  }

  const start = (startOpts: ChatStartOptions) => {
    clear()
    sessionCwd = startOpts.cwd
    pendingSessionToLoad = startOpts.sessionId ?? null
    isSpawning = true
    spawn(startOpts.presetId)
  }

  const respondToPermission = (permissionId: string, response: string) => {
    acpConverter.respondToPermission(permissionId, response)

    const requestId = permissionRequestIds.get(permissionId)
    if (requestId !== undefined) {
      permissionRequestIds.delete(permissionId)
      sendJsonRpcResponse(requestId, {
        outcome: { outcome: 'selected', optionId: response },
      })
    } else {
      sendJsonRpcNotification('permission/response', { permissionId, response })
    }

    permissionAsks.value = acpConverter.getPermissionAsks()
  }

  const setConfigOption = (configId: string, value: string) => {
    if (!sessionId) return

    const opt = configOptions.value.find(o => o.id === configId)
    let requestId: number

    if (opt?.category === 'model') {
      requestId = sendJsonRpc('session/set_model', { sessionId, modelId: value })
    } else if (opt?.category === 'mode') {
      requestId = sendJsonRpc('session/set_mode', { sessionId, modeId: value })
    } else {
      requestId = sendJsonRpc('session/set_config_option', { sessionId, configId, value })
    }

    pendingConfigRequestIds.add(requestId)

    // Optimistically update the local value
    if (opt) {
      configOptions.value = configOptions.value.map(o =>
        o.id === configId ? { ...o, currentValue: value } : o,
      )
    }
  }

  return {
    messages: readonly(messages),
    status: readonly(status),
    input,
    configOptions: readonly(configOptions),
    sendMessage,
    stop,
    clear,
    start,
    respondToPermission,
    setConfigOption,
  }
}
