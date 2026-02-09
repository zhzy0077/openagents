import type { ProcessTransport } from './types'

export interface TransportManager<T extends ProcessTransport> {
  get(peerId: string): T | undefined
  kill(peerId: string, signal?: string): boolean
  cleanup(peerId: string): void
}

/**
 * Creates a reusable transport manager with get/kill/cleanup methods.
 * The factory using this manager must handle the transports Map and create() logic.
 */
export function createTransportManager<T extends ProcessTransport>(
  transports: Map<string, T>
): TransportManager<T> {
  return {
    get(peerId: string): T | undefined {
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
}
