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
