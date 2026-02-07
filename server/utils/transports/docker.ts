import Docker from 'dockerode'
import { PassThrough } from 'node:stream'
import type { ProcessTransport, TransportFactory, TransportOptions, TransportCallbacks } from './types'

const CONTAINER_WORKDIR = '/workspace'

interface DockerState {
  container: Docker.Container
  stream: NodeJS.ReadWriteStream
  destroyed: boolean
}

class DockerProcessTransport implements ProcessTransport {
  readonly pid: number | undefined = undefined
  private state: DockerState

  constructor(state: DockerState) {
    this.state = state
  }

  write(data: string): void {
    if (this.state.destroyed) return
    try {
      this.state.stream.write(data)
    } catch {
    }
  }

  kill(signal?: string): boolean {
    if (this.state.destroyed) return false
    this.state.container.kill({ signal: signal || 'SIGTERM' }).catch(() => {})
    return true
  }

  destroy(): void {
    if (this.state.destroyed) return
    this.state.destroyed = true
    this.state.container.stop({ t: 2 }).catch(() => {}).then(() => {
      this.state.container.remove({ force: true }).catch(() => {})
    })
  }
}

const docker = new Docker()
const transports = new Map<string, DockerProcessTransport>()

export const dockerTransportFactory: TransportFactory = {
  create(
    peerId: string,
    command: string,
    options: TransportOptions = {},
    callbacks: TransportCallbacks
  ): ProcessTransport {
    if (transports.has(peerId)) {
      dockerTransportFactory.cleanup(peerId)
    }

    const { args = [], cwd, env, image } = options

    if (!image) {
      throw new Error('Docker transport requires an "image" in options')
    }

    const containerEnv = env
      ? Object.entries(env).map(([k, v]) => `${k}=${v}`)
      : []

    const binds: string[] = []
    if (cwd) {
      binds.push(`${cwd}:${CONTAINER_WORKDIR}`)
    }

    const state: DockerState = {
      container: null!,
      stream: null!,
      destroyed: false
    }

    const transport = new DockerProcessTransport(state)
    transports.set(peerId, transport)

    startContainer(peerId, state, image, command, args, containerEnv, binds, callbacks)

    return transport
  },

  get(peerId: string): ProcessTransport | undefined {
    return transports.get(peerId)
  },

  kill(peerId: string, signal?: string): boolean {
    const transport = transports.get(peerId)
    if (!transport) return false
    transport.kill(signal)
    transports.delete(peerId)
    return true
  },

  cleanup(peerId: string): void {
    const transport = transports.get(peerId)
    if (!transport) return
    transport.destroy()
    transports.delete(peerId)
  }
}

async function startContainer(
  peerId: string,
  state: DockerState,
  image: string,
  command: string,
  args: string[],
  env: string[],
  binds: string[],
  callbacks: TransportCallbacks
): Promise<void> {
  try {
    const container = await docker.createContainer({
      Image: image,
      Cmd: [command, ...args],
      Env: env,
      WorkingDir: CONTAINER_WORKDIR,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Binds: binds.length > 0 ? binds : undefined,
        AutoRemove: true
      }
    })

    state.container = container

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true
    })

    state.stream = stream

    const stdout = new PassThrough()
    const stderr = new PassThrough()

    docker.modem.demuxStream(stream, stdout, stderr)

    stdout.on('data', (data: Buffer) => {
      if (!state.destroyed) callbacks.onStdout(data.toString())
    })

    stderr.on('data', (data: Buffer) => {
      if (!state.destroyed) callbacks.onStderr(data.toString())
    })

    await container.start()

    container.wait().then((result: { StatusCode: number }) => {
      if (state.destroyed) return
      transports.delete(peerId)
      callbacks.onClose(result.StatusCode, null)
    }).catch(() => {
      if (state.destroyed) return
      transports.delete(peerId)
      callbacks.onClose(null, 'SIGKILL')
    })
  } catch (err) {
    transports.delete(peerId)
    callbacks.onError(err instanceof Error ? err.message : String(err))
    callbacks.onClose(1, null)
  }
}
