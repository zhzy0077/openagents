import type { TerminalMessage } from '~/types/chat'
import { AGENT_PRESETS } from '~/composables/useSettings'

export interface UseAgentProcessOptions {
  autoSpawn?: boolean
  onSpawned?: (pid: number) => void
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
  onExit?: (code: number | null, signal?: string) => void
  onError?: (error: Error) => void
}

export function useAgentProcess(options: UseAgentProcessOptions = {}) {
  const config = useRuntimeConfig()
  const { activePreset } = useSettings()
  const ws = ref<WebSocket | null>(null)
  const status = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const pid = ref<number | null>(null)
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let intentionalDisconnect = false
  let pendingMessages: TerminalMessage[] = []

  const isSocketActive = (socket: WebSocket | null): boolean => {
    return socket !== null && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  }

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const flushPendingMessages = () => {
    if (ws.value?.readyState !== WebSocket.OPEN) return
    const queued = pendingMessages
    pendingMessages = []
    for (const msg of queued) {
      ws.value.send(JSON.stringify(msg))
    }
  }

  const connect = () => {
    if (isSocketActive(ws.value)) {
      return
    }

    clearReconnectTimer()
    intentionalDisconnect = false
    status.value = 'connecting'
    const wsUrl = config.public.wsEndpoint as string
    const socket = new WebSocket(wsUrl)
    ws.value = socket

    socket.onopen = () => {
      if (ws.value !== socket) return
      status.value = 'connected'
      flushPendingMessages()
      if (options.autoSpawn !== false) {
        send({
          type: 'spawn',
          command: activePreset.value.command,
          args: activePreset.value.args.length > 0 ? [...activePreset.value.args] : undefined,
        })
      }
    }

    socket.onmessage = (event) => {
      if (ws.value !== socket) return
      try {
        const message: TerminalMessage = JSON.parse(event.data)

        switch (message.type) {
          case 'spawned':
            pid.value = message.pid ?? null
            if (message.pid && options.onSpawned) {
              options.onSpawned(message.pid)
            }
            break
          case 'stdout':
            if (message.data && options.onStdout) {
              options.onStdout(message.data)
            }
            break
          case 'stderr':
            if (message.data && options.onStderr) {
              options.onStderr(message.data)
            }
            break
          case 'exit':
            pid.value = null
            if (options.onExit) {
              options.onExit(message.code ?? null, message.signal)
            }
            break
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
        if (options.onError) {
          options.onError(error as Error)
        }
      }
    }

    socket.onerror = (event) => {
      if (ws.value !== socket) return
      status.value = 'error'
      console.error('WebSocket error:', event)
      if (options.onError) {
        options.onError(new Error('WebSocket connection error'))
      }
    }

    socket.onclose = () => {
      if (ws.value !== socket) return
      ws.value = null
      pendingMessages = []
      status.value = 'disconnected'
      pid.value = null
      // Only auto-reconnect if this was an unexpected close
      if (!intentionalDisconnect) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          if (status.value === 'disconnected' && !intentionalDisconnect) {
            connect()
          }
        }, 3000)
      }
    }
  }

  const send = (message: TerminalMessage) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message))
    } else if (!intentionalDisconnect) {
      // Queue messages when WS is still connecting or not yet created (pre-mount)
      pendingMessages.push(message)
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  const sendStdin = (data: string) => {
    send({ type: 'stdin', data })
  }

  const spawn = (presetId?: string) => {
    const preset = presetId
      ? AGENT_PRESETS.find(p => p.id === presetId) ?? activePreset.value
      : activePreset.value
    send({
      type: 'spawn',
      command: preset.command,
      args: preset.args.length > 0 ? [...preset.args] : undefined,
    })
  }

  const kill = () => {
    send({ type: 'kill' })
  }

  const disconnect = () => {
    intentionalDisconnect = true
    clearReconnectTimer()
    pendingMessages = []
    const socket = ws.value
    if (socket) {
      socket.close()
      ws.value = null
    }
    status.value = 'disconnected'
    pid.value = null
  }

  // Auto-connect on mount
  onMounted(() => {
    connect()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    status: readonly(status),
    pid: readonly(pid),
    connect,
    disconnect,
    sendStdin,
    spawn,
    kill
  }
}
