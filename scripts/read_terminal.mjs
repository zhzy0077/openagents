#!/usr/bin/env node

/**
 * Read Terminal — Connect to ws://localhost:3000/ws/terminal,
 * spawn an agent, and load an existing ACP session.
 *
 * Usage:
 *   node scripts/read_terminal.mjs <sessionId> [--preset claude-code|opencode] [--cwd <path>]
 *   node scripts/read_terminal.mjs --list [--preset claude-code|opencode] [--cwd <path>]
 *
 * Examples:
 *   node scripts/read_terminal.mjs --list
 *   node scripts/read_terminal.mjs 589ef251-f13d-40f1-88ba-8ea456567455
 *   node scripts/read_terminal.mjs --list --preset opencode --cwd /home/user/project
 */

// Uses native WebSocket (Node 21+)

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)

function getFlag(name) {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

const listMode = args.includes('--list')
const sessionId = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') === false)
  ?? args.find(a => !a.startsWith('--') && !['--preset', '--cwd', '--list'].includes(args[args.indexOf(a) - 1]))

// Re-parse positional: first non-flag arg
let positionalSessionId = null
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    if (['--preset', '--cwd'].includes(args[i])) i++ // skip value
    continue
  }
  positionalSessionId = args[i]
  break
}

const preset = getFlag('preset') ?? 'claude-code'
const cwd = getFlag('cwd') ?? '.'
const wsUrl = getFlag('url') ?? 'ws://localhost:3000/ws/terminal'

const PRESETS = {
  'claude-code': { command: 'claude-code-acp', args: [] },
  'opencode': { command: 'opencode', args: ['acp'] },
}

const presetConfig = PRESETS[preset]
if (!presetConfig) {
  console.error(`Unknown preset: ${preset}. Available: ${Object.keys(PRESETS).join(', ')}`)
  process.exit(1)
}

if (!listMode && !positionalSessionId) {
  console.error('Usage: node scripts/read_terminal.mjs <sessionId> [--preset ...] [--cwd ...]')
  console.error('       node scripts/read_terminal.mjs --list [--preset ...] [--cwd ...]')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let nextRequestId = 1
let initializeRequestId = null
let listRequestId = null
let loadRequestId = null
let canLoadSession = false
let canListSessions = false
let loadedSessionId = null

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

console.log(`Connecting to ${wsUrl} ...`)
const ws = new WebSocket(wsUrl)

function send(obj) {
  ws.send(JSON.stringify(obj))
}

function sendJsonRpc(method, params) {
  const id = nextRequestId++
  const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
  send({ type: 'stdin', data: msg })
  return id
}

ws.addEventListener('open', () => {
  console.log('Connected. Spawning agent...')
  send({
    type: 'spawn',
    command: presetConfig.command,
    args: presetConfig.args.length > 0 ? presetConfig.args : undefined,
  })
})

ws.addEventListener('message', (event) => {
  let msg
  try {
    msg = JSON.parse(event.data)
  } catch {
    console.error('Bad JSON from server:', String(event.data).slice(0, 200))
    return
  }

  switch (msg.type) {
    case 'spawned':
      console.log(`Agent spawned (pid: ${msg.pid}). Sending initialize...`)
      initializeRequestId = sendJsonRpc('initialize', {
        protocolVersion: 1,
        clientCapabilities: {},
      })
      break

    case 'acp:response':
      handleResponse(msg)
      break

    case 'acp:message_chunk':
      handleMessageChunk(msg.message)
      break

    case 'acp:tool_call':
      handleToolCall(msg.toolCall)
      break

    case 'acp:permission_request':
      handlePermission(msg.permissionAsk)
      break

    case 'acp:finalized':
      if (msg.message) {
        console.log('\n--- Finalized message ---')
        printMessage(msg.message)
      }
      break

    case 'exit':
      console.log(`\nAgent exited (code: ${msg.code}, signal: ${msg.signal})`)
      process.exit(msg.code ?? 0)
      break

    case 'error':
      console.error(`Server error: ${msg.message}`)
      break

    default:
      // Other message types (config_update, etc.)
      if (msg.type === 'acp:config_update') {
        // Silently skip config updates
      } else {
        console.log(`[${msg.type}]`, JSON.stringify(msg).slice(0, 200))
      }
  }
})

ws.addEventListener('close', () => {
  console.log('WebSocket closed.')
  process.exit(0)
})

ws.addEventListener('error', (event) => {
  console.error('WebSocket error:', event.message ?? event)
  process.exit(1)
})

// ---------------------------------------------------------------------------
// ACP response handling
// ---------------------------------------------------------------------------

function handleResponse(msg) {
  const { id, result, error } = msg

  if (error) {
    console.error(`\nJSON-RPC error (id=${id}): [${error.code}] ${error.message}`)
    if (id === loadRequestId) {
      console.error('Failed to load session.')
      cleanup()
    }
    return
  }

  if (id === initializeRequestId) {
    initializeRequestId = null
    const caps = result?.agentCapabilities ?? {}
    canLoadSession = Boolean(caps.loadSession)
    canListSessions = Boolean(caps.sessionCapabilities?.list)

    console.log(`Agent: ${result?.agentInfo?.name ?? 'unknown'} v${result?.agentInfo?.version ?? '?'}`)
    console.log(`Capabilities: loadSession=${canLoadSession}, list=${canListSessions}`)

    if (listMode) {
      if (!canListSessions) {
        console.error('Agent does not support session/list.')
        cleanup()
        return
      }
      console.log('\nListing sessions...')
      listRequestId = sendJsonRpc('session/list', {})
    } else {
      // Load mode
      if (!canLoadSession) {
        console.error('Agent does not support session/load.')
        cleanup()
        return
      }
      if (canListSessions) {
        // List first to find the session's cwd
        console.log(`\nListing sessions to find cwd for ${positionalSessionId}...`)
        listRequestId = sendJsonRpc('session/list', {})
      } else {
        // Direct load with provided cwd
        startLoad(positionalSessionId, cwd)
      }
    }
    return
  }

  if (id === listRequestId) {
    listRequestId = null
    const sessions = result?.sessions ?? []

    if (listMode) {
      // Print all sessions and exit
      if (sessions.length === 0) {
        console.log('No sessions found.')
      } else {
        console.log(`\nFound ${sessions.length} session(s):\n`)
        for (const s of sessions) {
          const title = s.title ? ` — ${s.title}` : ''
          const updated = s.updatedAt ? ` (${s.updatedAt})` : ''
          console.log(`  ${s.sessionId}${title}${updated}`)
          console.log(`    cwd: ${s.cwd}`)
        }
      }
      console.log('')
      cleanup()
      return
    }

    // Find the target session
    const target = sessions.find(s => s.sessionId === positionalSessionId)
    if (!target) {
      console.error(`Session ${positionalSessionId} not found in agent's session list.`)
      console.log('Available sessions:')
      for (const s of sessions) {
        console.log(`  ${s.sessionId} — ${s.title ?? '(untitled)'} [cwd: ${s.cwd}]`)
      }
      cleanup()
      return
    }

    console.log(`Found session: ${target.title ?? '(untitled)'} [cwd: ${target.cwd}]`)
    startLoad(positionalSessionId, target.cwd)
    return
  }

  if (id === loadRequestId) {
    loadRequestId = null
    console.log(`\n✓ Session ${loadedSessionId} loaded successfully.`)
    console.log('Session replay complete. Waiting for further events (Ctrl+C to exit)...\n')
    return
  }

  // Other responses
  console.log(`[response id=${id}]`, JSON.stringify(result).slice(0, 300))
}

function startLoad(sid, sessionCwd) {
  console.log(`Loading session ${sid} (cwd: ${sessionCwd})...`)
  loadedSessionId = sid
  loadRequestId = sendJsonRpc('session/load', {
    sessionId: sid,
    cwd: sessionCwd,
    mcpServers: [],
  })
}

// ---------------------------------------------------------------------------
// Message display
// ---------------------------------------------------------------------------

function handleMessageChunk(message) {
  printMessage(message)
}

function printMessage(message) {
  if (!message) return
  const role = message.role ?? '?'
  const prefix = role === 'user' ? '\x1b[36m[user]\x1b[0m' : '\x1b[32m[assistant]\x1b[0m'

  if (message.parts && message.parts.length > 0) {
    for (const part of message.parts) {
      switch (part.type) {
        case 'text':
          if (part.content) {
            process.stdout.write(`${prefix} ${part.content}\n`)
          }
          break
        case 'thought':
          if (part.content) {
            process.stdout.write(`\x1b[33m[thought]\x1b[0m ${part.content.slice(0, 200)}${part.content.length > 200 ? '...' : ''}\n`)
          }
          break
        case 'tool_call':
          process.stdout.write(`\x1b[35m[tool: ${part.toolName ?? part.toolCallId ?? '?'}]\x1b[0m ${part.status ?? ''}\n`)
          break
        case 'permission_ask':
          process.stdout.write(`\x1b[31m[permission]\x1b[0m ${part.content ?? ''}\n`)
          break
        default:
          process.stdout.write(`[${part.type}] ${JSON.stringify(part).slice(0, 200)}\n`)
      }
    }
  } else if (message.content) {
    process.stdout.write(`${prefix} ${message.content}\n`)
  }
}

function handleToolCall(toolCall) {
  const status = toolCall.status ?? ''
  const title = toolCall.title ?? toolCall.toolCallId ?? '?'
  process.stdout.write(`\x1b[35m[tool: ${title}]\x1b[0m ${status}\n`)
}

function handlePermission(permissionAsk) {
  console.log(`\x1b[31m[permission request]\x1b[0m ${permissionAsk.permissionQuestion ?? permissionAsk.question ?? ''}`)
  if (permissionAsk.permissionOptions || permissionAsk.options) {
    const opts = permissionAsk.permissionOptions ?? permissionAsk.options ?? []
    for (const opt of opts) {
      console.log(`  - ${opt.label ?? opt.name}: ${opt.value ?? opt.optionId}`)
    }
  }
  console.log('  (This script does not respond to permissions. Use the UI for interactive sessions.)')
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

function cleanup() {
  send({ type: 'kill' })
  setTimeout(() => {
    ws.close()
    process.exit(0)
  }, 1000)
}

process.on('SIGINT', () => {
  console.log('\nInterrupted. Killing agent...')
  cleanup()
})
