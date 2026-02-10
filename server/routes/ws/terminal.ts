import type { Peer } from 'crossws'
import type { TransportFactory } from '../../utils/transports/types'
import { localTransportFactory } from '../../utils/transports/local'
import { dockerTransportFactory } from '../../utils/transports/docker'
import { AcpConverter } from '../../utils/acp-converter'
import type {
  ClientMessage,
  SpawnClientMessage,
  StdinClientMessage,
  KillClientMessage,
  PermissionResponseClientMessage,
  ServerMessage,
} from '#shared/types/ws-messages'

const transportFactory: TransportFactory =
  process.env.TRANSPORT === 'docker' ? dockerTransportFactory : localTransportFactory

/** Per-peer AcpConverter instances — created on spawn, destroyed on disconnect/exit */
const converters = new Map<string, AcpConverter>()

/** Per-peer high-water mark: number of finalized messages already sent to the client */
const sentCounts = new Map<string, number>()

function sendMessage(peer: Peer, message: ServerMessage): void {
  try {
    peer.send(JSON.stringify(message))
  } catch {
    // Peer already disconnected — safe to ignore
  }
}

function sendError(peer: Peer, message: string): void {
  sendMessage(peer, { type: 'error', message })
}

/**
 * After calling converter.process(data), extract structured state
 * and send corresponding WS messages to the peer.
 *
 * Uses a high-water mark (`sentCounts`) so finalized messages are sent
 * exactly once, while the in-progress current message is re-sent on
 * every chunk (same as before).
 */
function sendConverterState(peer: Peer, converter: AcpConverter): void {
  const allMessages = converter.getMessages()
  const alreadySent = sentCounts.get(peer.id) ?? 0

  for (let i = alreadySent; i < allMessages.length; i++) {
    const msg = allMessages[i]
    if (msg) {
      sendMessage(peer, { type: 'acp:message_chunk', message: msg })
    }
  }

  // Mark all but the last (in-progress) message as sent.
  // The last message may still be accumulating chunks, so re-send it next time.
  if (allMessages.length > 1) {
    sentCounts.set(peer.id, allMessages.length - 1)
  }

  for (const toolCall of converter.getToolCalls()) {
    sendMessage(peer, { type: 'acp:tool_call', toolCall })
  }

  for (const permissionAsk of converter.getPermissionAsks()) {
    sendMessage(peer, { type: 'acp:permission_request', permissionAsk })
  }
}

function handleSpawn(peer: Peer, msg: SpawnClientMessage): void {
  if (!msg.command || typeof msg.command !== 'string') {
    sendError(peer, 'Missing or invalid "command"')
    return
  }

  // Create a fresh converter for this peer
  const converter = new AcpConverter()
  converter.setCallbacks({
    onResponse: (response) => {
      // Finalize the current in-progress message before sending the response.
      // This ensures the next prompt turn starts a fresh assistant message
      // instead of appending to the previous one.
      converter.finalizeCurrentMessage()
      // Flush any remaining unsent finalized messages to the client
      sendConverterState(peer, converter)
      // Update high-water mark to cover all finalized messages so the next
      // turn's sendConverterState doesn't re-send them.
      const allMessages = converter.getMessages()
      sentCounts.set(peer.id, allMessages.length)

      sendMessage(peer, {
        type: 'acp:response',
        id: response.id,
        result: response.result,
        error: response.error,
      })
    },
    onConfigOptionsUpdate: (options) => {
      sendMessage(peer, { type: 'acp:config_update', options })
    },
    onPermissionRequest: (_requestId, _params) => {
      // Permission requests are also surfaced via session/update -> permission_ask,
      // which gets picked up in sendConverterState. The callback fires for the
      // JSON-RPC request path (session/request_permission) — the converter already
      // injects the permissionAsk part into its state by this point.
    },
  })
  converters.set(peer.id, converter)

  try {
    const transport = transportFactory.create(peer.id, msg.command, {
      args: msg.args,
      cwd: msg.cwd,
      env: msg.env,
      image: msg.image
    }, {
      onStdout: (data: string) => {
        converter.process(data)
        sendConverterState(peer, converter)
      },
      onStderr: (data: string) => {
        converter.process(data)
        sendConverterState(peer, converter)
      },
      onError: (error: string) => sendError(peer, error),
      onClose: (code: number | null, signal: string | null) => {
        // Flush any remaining unsent messages before finalizing
        sendConverterState(peer, converter)
        // Finalize and send the last message snapshot
        const finalMessage = converter.finalize()
        sendMessage(peer, { type: 'acp:finalized', message: finalMessage })
        // Then send exit
        sendMessage(peer, { type: 'exit', code, signal })
        // Clean up converter and sent tracking
        converters.delete(peer.id)
        sentCounts.delete(peer.id)
      },
    })

    sendMessage(peer, { type: 'spawned', pid: transport.pid ?? 0 })
  } catch (err) {
    converters.delete(peer.id)
    sendError(peer, err instanceof Error ? err.message : String(err))
  }
}

function handleStdin(peer: Peer, msg: StdinClientMessage): void {
  const transport = transportFactory.get(peer.id)
  if (!transport) {
    return
  }

  transport.write(msg.data)
}

function handleKill(peer: Peer, msg: KillClientMessage): void {
  const killed = transportFactory.kill(peer.id, msg.signal)

  if (!killed) {
    sendError(peer, 'No process running')
  }
}

function handlePermissionResponse(peer: Peer, msg: PermissionResponseClientMessage): void {
  const converter = converters.get(peer.id)
  if (!converter) {
    sendError(peer, 'No active session for permission response')
    return
  }

  const transport = transportFactory.get(peer.id)
  if (!transport) {
    sendError(peer, 'No process running for permission response')
    return
  }

  // Update converter state
  converter.respondToPermission(msg.permissionId, msg.optionId)

  // Construct JSON-RPC response and write to transport stdin.
  // The ACP SDK expects: { outcome: { outcome: "selected", optionId } }
  const jsonRpcResponse = JSON.stringify({
    jsonrpc: '2.0',
    id: Number(msg.permissionId),
    result: { outcome: { outcome: 'selected', optionId: msg.optionId } },
  }) + '\n'

  transport.write(jsonRpcResponse)

  // Send updated state back to frontend
  sendConverterState(peer, converter)
}

function cleanupConverter(peerId: string): void {
  const converter = converters.get(peerId)
  if (converter) {
    converter.reset()
    converters.delete(peerId)
  }
  sentCounts.delete(peerId)
}

export default defineWebSocketHandler({
  open(peer) {
    console.log(`[ws] Client connected: ${peer.id}`)
  },

  message(peer, message) {
    let msg: ClientMessage

    try {
      const parsed: unknown = JSON.parse(message.text())
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
        sendError(peer, 'Missing "type" field')
        return
      }
      msg = parsed as ClientMessage
    } catch {
      sendError(peer, 'Invalid JSON')
      return
    }

    switch (msg.type) {
      case 'spawn':
        handleSpawn(peer, msg)
        break
      case 'stdin':
        handleStdin(peer, msg)
        break
      case 'kill':
        handleKill(peer, msg)
        break
      case 'permission_response':
        handlePermissionResponse(peer, msg)
        break
      default:
        sendError(peer, `Unknown message type: ${String((msg as Record<string, unknown>).type)}`)
    }
  },

  close(peer) {
    console.log(`[ws] Client disconnected: ${peer.id}`)
    cleanupConverter(peer.id)
    transportFactory.cleanup(peer.id)
  },

  error(peer, error) {
    console.error(`[ws] Error for ${peer.id}:`, error)
    cleanupConverter(peer.id)
    transportFactory.cleanup(peer.id)
  }
})
