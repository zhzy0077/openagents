import { spawn, type ChildProcess } from 'node:child_process'
import type { ProcessTransport, TransportFactory, TransportOptions, TransportCallbacks } from './types'

class LocalProcessTransport implements ProcessTransport {
  readonly pid: number | undefined
  private child: ChildProcess

  constructor(child: ChildProcess) {
    this.child = child
    this.pid = child.pid
  }

  write(data: string): void {
    if (this.child.stdin?.writable) {
      this.child.stdin.write(data)
    }
  }

  kill(signal?: string): boolean {
    return this.child.kill((signal || 'SIGTERM') as NodeJS.Signals)
  }

  destroy(): void {
    this.child.stdin?.destroy()
    this.child.stdout?.destroy()
    this.child.stderr?.destroy()
    this.child.kill('SIGKILL')
  }
}

const transports = new Map<string, LocalProcessTransport>()

export const localTransportFactory: TransportFactory = {
  create(
    peerId: string,
    command: string,
    options: TransportOptions = {},
    callbacks: TransportCallbacks
  ): ProcessTransport {
    if (transports.has(peerId)) {
      localTransportFactory.cleanup(peerId)
    }

    const { args = [], cwd, env } = options
    const processEnv = env ? { ...process.env, ...env } : process.env

    const child = spawn(command, args, {
      cwd,
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const transport = new LocalProcessTransport(child)
    transports.set(peerId, transport)

    child.stdout?.on('data', (data: Buffer) => {
      callbacks.onStdout(data.toString())
    })

    child.stderr?.on('data', (data: Buffer) => {
      callbacks.onStderr(data.toString())
    })

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      transports.delete(peerId)
      callbacks.onClose(code, signal)
    })

    child.on('error', (err: Error) => {
      callbacks.onError(err.message)
    })

    return transport
  },

  get(peerId: string): ProcessTransport | undefined {
    return transports.get(peerId)
  },

  kill(peerId: string, signal?: string): boolean {
    const transport = transports.get(peerId)
    if (!transport) {
      return false
    }
    transport.kill(signal)
    transports.delete(peerId)
    return true
  },

  cleanup(peerId: string): void {
    const transport = transports.get(peerId)
    if (!transport) {
      return
    }
    transport.destroy()
    transports.delete(peerId)
  }
}
