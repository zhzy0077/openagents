import crypto from 'node:crypto'
import type { TransportFactory } from '../utils/transports/types'
import { localTransportFactory } from '../utils/transports/local'
import { dockerTransportFactory } from '../utils/transports/docker'
import { AcpConverter } from '../utils/acp-converter'
import type { AcpPermissionRequestParams, JsonRpcResponse, NewSessionResult } from '#shared/types/acp'
import { AGENT_PRESETS } from '#shared/agent-presets'

const transportFactory: TransportFactory =
  process.env.TRANSPORT === 'docker' ? dockerTransportFactory : localTransportFactory

export default defineEventHandler(async (event) => {
  // Step 1: Auth check
  const apiKey = String(useRuntimeConfig().openagentsApiKey ?? '')
  if (!apiKey) {
    throw createError({ statusCode: 503, message: 'API key not configured' })
  }

  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== apiKey) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  // Step 2: Parse and validate
  const body = await readBody<{
    prompt?: string
    preset?: string
    cwd?: string
    timeout?: number
  }>(event)

  if (!body?.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    throw createError({ statusCode: 400, message: 'prompt is required' })
  }

  const presetId = body.preset ?? 'claude-code'
  const preset = AGENT_PRESETS.find(p => p.id === presetId)
  if (!preset) {
    throw createError({ statusCode: 400, message: 'Invalid preset' })
  }

  const promptText = body.prompt.trim()
  const cwd = body.cwd ?? '.'
  const timeoutMs = Math.min(body.timeout ?? 120_000, 300_000)

  // Step 3: Spawn agent and ACP handshake
  const peerId = `rest-${crypto.randomUUID()}`
  const converter = new AcpConverter()
  let nextRequestId = 1

  let initializeRequestId: number | null = null
  let newSessionRequestId: number | null = null
  let promptRequestId: number | null = null
  let sessionId: string | null = null
  let timedOut = false
  let responseText = ''

  try {
    responseText = await Promise.race([
      new Promise<string>((resolve, reject) => {
        const sendJsonRpc = (method: string, params: unknown): number => {
          const id = nextRequestId++
          const message = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
          const transport = transportFactory.get(peerId)
          if (transport) {
            transport.write(message)
          }
          return id
        }

        converter.setCallbacks({
          onResponse: (response: JsonRpcResponse) => {
            if (response.error) {
              reject(new Error(`ACP error: ${response.error.message}`))
              return
            }

            if (response.id === initializeRequestId) {
              initializeRequestId = null
              newSessionRequestId = sendJsonRpc('session/new', { cwd, mcpServers: [] })
            } else if (response.id === newSessionRequestId) {
              newSessionRequestId = null
              const result = response.result as NewSessionResult
              sessionId = result.sessionId
              promptRequestId = sendJsonRpc('session/prompt', {
                sessionId,
                prompt: [{ type: 'text', text: promptText }],
              })
            } else if (response.id === promptRequestId) {
              promptRequestId = null
              resolve(converter.getCurrentMessage()?.content ?? '')
            }
          },
          onPermissionRequest: (requestId: number, params: AcpPermissionRequestParams) => {
            // Auto-approve: find option with 'allow' in optionId, fall back to first
            const optionId =
              params.options.find(o => o.optionId.includes('allow'))?.optionId
              ?? params.options[0]?.optionId
            if (optionId) {
              const transport = transportFactory.get(peerId)
              if (transport) {
                transport.write(
                  JSON.stringify({ jsonrpc: '2.0', id: requestId, result: { optionId } }) + '\n',
                )
              }
              converter.respondToPermission(String(requestId), optionId)
            }
          },
        })

        transportFactory.create(peerId, preset.command, { args: preset.args, cwd }, {
          onStdout: (data: string) => {
            converter.process(data)
          },
          onStderr: (data: string) => {
            converter.process(data)
          },
          onError: (error: string) => {
            reject(new Error(error))
          },
          onClose: (_code: number | null, _signal: string | null) => {
            // Process exited — resolve with whatever we have if not yet settled
            const finalMessage = converter.finalize()
            resolve(finalMessage?.content ?? converter.getCurrentMessage()?.content ?? '')
          },
        })

        // Kick off ACP handshake
        initializeRequestId = sendJsonRpc('initialize', { protocolVersion: 1, clientCapabilities: {} })
      }),

      // Step 4: Timeout handling
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      }),
    ])
  } catch (err) {
    if (err instanceof Error && err.message === 'timeout') {
      timedOut = true
      responseText = converter.getCurrentMessage()?.content ?? ''
    } else {
      throw createError({
        statusCode: 502,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  } finally {
    // Step 5: Cleanup (ALWAYS)
    converter.reset()
    transportFactory.cleanup(peerId)
  }

  // Step 6: Return
  if (timedOut) {
    return { response: responseText, timedOut: true }
  }
  return { response: responseText }
})
