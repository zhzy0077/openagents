export interface AgentPreset {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  /** Lucide icon name for the preset button */
  icon: string
  /** Tailwind bg-color class for the icon badge */
  iconBg: string
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Anthropic\'s Claude Code agent (bundled adapter)',
    command: 'claude-code-acp',
    args: [],
    icon: 'i-lucide-bot',
    iconBg: 'bg-[#D97706]',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    description: 'Open-source coding agent',
    command: 'opencode',
    args: ['acp'],
    icon: 'i-lucide-code',
    iconBg: 'bg-[#3B82F6]',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    description: 'Google\'s Gemini coding agent (experimental ACP)',
    command: 'gemini',
    args: ['--experimental-acp'],
    icon: 'i-lucide-sparkles',
    iconBg: 'bg-[#4285F4]',
  },
  {
    id: 'copilot-cli',
    name: 'Copilot CLI',
    description: 'GitHub Copilot coding agent',
    command: 'copilot',
    args: ['--acp'],
    icon: 'i-lucide-github',
    iconBg: 'bg-[#6E40C9]',
  },
]
