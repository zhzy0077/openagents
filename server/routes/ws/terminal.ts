import type { Peer } from 'crossws'
import type { TransportFactory } from '../../utils/transports/types'
import { localTransportFactory } from '../../utils/transports/local'
import { dockerTransportFactory } from '../../utils/transports/docker'

const transportFactory: TransportFactory =
  process.env.TRANSPORT === 'docker' ? dockerTransportFactory : localTransportFactory

interface SpawnMessage {
  type: 'spawn'
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  image?: string
}

interface StdinMessage {
  type: 'stdin'
  data: string
}

interface KillMessage {
  type: 'kill'
  signal?: string
}

type ClientMessage = SpawnMessage | StdinMessage | KillMessage

function sendMessage(peer: Peer, message: object): void {
  try {
    peer.send(JSON.stringify(message))
  } catch {
    // Peer already disconnected — safe to ignore
  }
}

function sendError(peer: Peer, message: string): void {
  sendMessage(peer, { type: 'error', message })
}

function handleSpawn(peer: Peer, msg: SpawnMessage): void {
  if (!msg.command || typeof msg.command !== 'string') {
    sendError(peer, 'Missing or invalid "command"')
    return
  }

  try {
    const transport = transportFactory.create(peer.id, msg.command, {
      args: msg.args,
      cwd: msg.cwd,
      env: msg.env,
      image: msg.image
    }, {
      onStdout: (data: string) => sendMessage(peer, { type: 'stdout', data }),
      onStderr: (data: string) => sendMessage(peer, { type: 'stderr', data }),
      onError: (error: string) => sendError(peer, error),
      onClose: (code: number | null, signal: string | null) => sendMessage(peer, { type: 'exit', code, signal }),
    })

    sendMessage(peer, { type: 'spawned', pid: transport.pid })
  } catch (err) {
    sendError(peer, err instanceof Error ? err.message : String(err))
  }
}

function handleStdin(peer: Peer, msg: StdinMessage): void {
  const transport = transportFactory.get(peer.id)
  if (!transport) {
    return
  }

  transport.write(msg.data)
}

function handleKill(peer: Peer, msg: KillMessage): void {
  const killed = transportFactory.kill(peer.id, msg.signal)

  if (!killed) {
    sendError(peer, 'No process running')
  }
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
      default:
        sendError(peer, `Unknown message type: ${String((msg as Record<string, unknown>).type)}`)
    }
  },

  close(peer) {
    console.log(`[ws] Client disconnected: ${peer.id}`)
    transportFactory.cleanup(peer.id)
  },

  error(peer, error) {
    console.error(`[ws] Error for ${peer.id}:`, error)
    transportFactory.cleanup(peer.id)
  }
})
