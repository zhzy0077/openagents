export interface AgentPreset {
  id: string
  name: string
  description: string
  command: string
  args: string[]
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic\'s Claude Code agent (bundled adapter)',
    command: 'claude-code-acp',
    args: [],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent',
    command: 'opencode',
    args: ["acp"],
  },
]

export type PermissionMode = 'always-ask' | 'always-allow'

export interface AppSettings {
  preset: string
  username: string
  permissionMode: PermissionMode
}

const STORAGE_KEY = 'app_settings'

const DEFAULT_SETTINGS: AppSettings = {
  preset: 'claude-code',
  username: 'User',
  permissionMode: 'always-ask',
}

function getPreset(id: string): AgentPreset {
  return AGENT_PRESETS.find(p => p.id === id) ?? AGENT_PRESETS[0]!
}

function loadFromStorage(): AppSettings {
  if (import.meta.server) return { ...DEFAULT_SETTINGS }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const parsed = JSON.parse(raw)
    return {
      preset: typeof parsed.preset === 'string' && AGENT_PRESETS.some(p => p.id === parsed.preset)
        ? parsed.preset
        : DEFAULT_SETTINGS.preset,
      username: typeof parsed.username === 'string' ? parsed.username : DEFAULT_SETTINGS.username,
      permissionMode: parsed.permissionMode === 'always-ask' || parsed.permissionMode === 'always-allow'
        ? parsed.permissionMode
        : DEFAULT_SETTINGS.permissionMode,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveToStorage(settings: AppSettings) {
  if (import.meta.server) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

// Singleton state — defaults first, then hydrate client-side to avoid SSR mismatch
const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

if (!import.meta.server) {
  settings.value = loadFromStorage()
}

export function useSettings() {
  const update = (newSettings: AppSettings) => {
    settings.value = { ...newSettings }
    saveToStorage(settings.value)
  }

  const activePreset = computed(() => getPreset(settings.value.preset))

  return {
    settings: readonly(settings),
    activePreset: readonly(activePreset),
    presets: AGENT_PRESETS,
    update,
  }
}
