#!/usr/bin/env node

/**
 * Inspect ACP responses — logs raw JSON for session/new and session/load
 * to see if session/load returns configOptions/models/modes.
 *
 * Usage:
 *   node scripts/inspect_responses.mjs <sessionId>
 *   node scripts/inspect_responses.mjs --new-only
 */

const args = process.argv.slice(2)
const sessionId = args.find(a => !a.startsWith('--'))
const newOnly = args.includes('--new-only')
const wsUrl = 'ws://localhost:3000/ws/terminal'
const cwd = '.'

let nextRequestId = 1
let initializeRequestId = null
let newSessionRequestId = null
let listRequestId = null
let loadRequestId = null

const ws = new WebSocket(wsUrl)

function send(obj) { ws.send(JSON.stringify(obj)) }
function sendJsonRpc(method, params) {
  const id = nextRequestId++
  send({ type: 'stdin', data: JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n' })
  return id
}

ws.addEventListener('open', () => {
  console.log('Connected. Spawning...')
  send({ type: 'spawn', command: 'claude-code-acp' })
})

ws.addEventListener('message', (event) => {
  let msg
  try { msg = JSON.parse(event.data) } catch { return }

  if (msg.type === 'spawned') {
    console.log('Spawned. Initializing...')
    initializeRequestId = sendJsonRpc('initialize', { protocolVersion: 1, clientCapabilities: {} })
    return
  }

  if (msg.type === 'acp:response') {
    const { id, result, error } = msg
    if (error) {
      console.error(`Error (id=${id}):`, JSON.stringify(error, null, 2))
      if (id === loadRequestId) done()
      return
    }

    if (id === initializeRequestId) {
      initializeRequestId = null
      const caps = result?.agentCapabilities ?? {}
      console.log(`Agent: ${result?.agentInfo?.name} v${result?.agentInfo?.version}`)

      if (newOnly || !sessionId) {
        // Just do session/new
        newSessionRequestId = sendJsonRpc('session/new', { cwd, mcpServers: [] })
      } else {
        // List first to find cwd, then load
        const canList = Boolean(caps.sessionCapabilities?.list)
        if (canList) {
          listRequestId = sendJsonRpc('session/list', {})
        } else {
          loadRequestId = sendJsonRpc('session/load', { sessionId, cwd, mcpServers: [] })
        }
      }
      return
    }

    if (id === newSessionRequestId) {
      newSessionRequestId = null
      console.log('\n=== session/new RESPONSE ===')
      console.log(JSON.stringify(result, null, 2))
      done()
      return
    }

    if (id === listRequestId) {
      listRequestId = null
      const sessions = result?.sessions ?? []
      const target = sessions.find(s => s.sessionId === sessionId)
      if (!target) {
        console.error(`Session ${sessionId} not found.`)
        done()
        return
      }
      loadRequestId = sendJsonRpc('session/load', { sessionId, cwd: target.cwd, mcpServers: [] })
      return
    }

    if (id === loadRequestId) {
      loadRequestId = null
      console.log('\n=== session/load RESPONSE ===')
      console.log(JSON.stringify(result, null, 2))
      done()
      return
    }

    // Other
    console.log(`[response id=${id}]`, JSON.stringify(result).slice(0, 500))
    return
  }

  // Log config updates that arrive during load
  if (msg.type === 'acp:config_update') {
    console.log('\n=== acp:config_update ===')
    console.log(JSON.stringify(msg, null, 2))
    return
  }

  // Skip message chunks / tool calls in this script
  if (['acp:message_chunk', 'acp:tool_call', 'acp:finalized', 'acp:permission_request'].includes(msg.type)) return
  if (msg.type === 'exit') {
    console.log(`Agent exited (code=${msg.code})`)
    process.exit(0)
  }
})

ws.addEventListener('close', () => process.exit(0))
ws.addEventListener('error', (e) => { console.error('WS error:', e.message); process.exit(1) })

function done() {
  console.log('\nDone. Killing agent...')
  send({ type: 'kill' })
  setTimeout(() => { ws.close(); process.exit(0) }, 2000)
}

process.on('SIGINT', () => { send({ type: 'kill' }); setTimeout(() => process.exit(0), 1000) })
