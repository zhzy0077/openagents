import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { ProcessTransport, TransportFactory, TransportOptions, TransportCallbacks } from './types'
import { createTransportManager } from './base-factory'

const CLAUDE_CODE_ACP_COMMAND = 'claude-code-acp'

// Lazily resolved on first use — avoids crashing the server at startup
// when the package isn't installed (e.g. non-Docker deploys using other agents).
let claudeCodeAcpEntry: string | undefined

function getClaudeCodeAcpEntry(): string {
  if (!claudeCodeAcpEntry) {
    try {
      claudeCodeAcpEntry = fileURLToPath(
        import.meta.resolve('@zed-industries/claude-code-acp/dist/index.js')
      )
    } catch {
      throw new Error(
        'Unable to resolve "@zed-industries/claude-code-acp". '
        + 'Make sure node_modules is available at the deployment root (see Dockerfile).'
      )
    }
  }
  return claudeCodeAcpEntry
}

interface ResolvedCommand {
  command: string
  args: string[]
}

function resolveCommand(command: string, args: string[]): ResolvedCommand {
  if (command !== CLAUDE_CODE_ACP_COMMAND) {
    return { command, args }
  }

  return {
    command: process.execPath,
    args: [getClaudeCodeAcpEntry(), ...args]
  }
}

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
const manager = createTransportManager(transports)

export const localTransportFactory: TransportFactory = {
  create(
    peerId: string,
    command: string,
    options: TransportOptions = {},
    callbacks: TransportCallbacks
  ): ProcessTransport {
    if (transports.has(peerId)) {
      manager.cleanup(peerId)
    }

    const { args = [], cwd, env } = options
    const processEnv = env ? { ...process.env, ...env } : process.env
    const resolved = resolveCommand(command, args)

    const child = spawn(resolved.command, resolved.args, {
      cwd,
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const transport = new LocalProcessTransport(child)
    transports.set(peerId, transport)

    child.stdout?.on('data', (data: Buffer) => {
      callbacks.onStdout(data.toString())
    })
    child.stdout?.on('error', () => {})

    child.stderr?.on('data', (data: Buffer) => {
      callbacks.onStderr(data.toString())
    })
    child.stderr?.on('error', () => {})

    child.stdin?.on('error', () => {})

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
    return manager.get(peerId)
  },

  kill(peerId: string, signal?: string): boolean {
    return manager.kill(peerId, signal)
  },

  cleanup(peerId: string): void {
    manager.cleanup(peerId)
  }
}
