export interface TransportOptions {
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  /** Docker image name — used by the docker transport, ignored by local. */
  image?: string
}

export interface TransportCallbacks {
  onStdout: (data: string) => void
  onStderr: (data: string) => void
  onError: (error: string) => void
  onClose: (code: number | null, signal: string | null) => void
}

export interface ProcessTransport {
  readonly pid: number | undefined
  /** Silently no-ops if not writable. */
  write(data: string): void
  kill(signal?: string): boolean
  destroy(): void
}

export interface TransportFactory {
  /** Kills existing transport for same peerId before creating new one. */
  create(
    peerId: string,
    command: string,
    options: TransportOptions,
    callbacks: TransportCallbacks
  ): ProcessTransport
  get(peerId: string): ProcessTransport | undefined
  kill(peerId: string, signal?: string): boolean
  /** Idempotent — no-op if peerId not found. */
  cleanup(peerId: string): void
}
