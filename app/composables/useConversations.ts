import { readonly } from 'vue'
import { useState } from '#imports'
import type { Conversation } from '../types/chat'
import { AGENT_PRESETS } from './useSettings'
import { useStorage } from './useStorage'

interface ConversationRow {
  id: string
  title: string
  presetId?: string
  cwd?: string
  sessionId?: string | null
  createdAt: string
  updatedAt: string
}

const DEFAULT_PRESET_ID = AGENT_PRESETS[0]?.id ?? 'claude-code'
const DEFAULT_CWD = '.'
const DEFAULT_TITLE = 'New Chat'

function conversationFromRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    messages: [],
    presetId: typeof row.presetId === 'string' ? row.presetId : DEFAULT_PRESET_ID,
    cwd: typeof row.cwd === 'string' && row.cwd.length > 0 ? row.cwd : DEFAULT_CWD,
    sessionId: typeof row.sessionId === 'string' && row.sessionId.length > 0 ? row.sessionId : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}

export function useConversations() {
  const conversations = useState<Conversation[]>('conversations', () => [])
  const loaded = useState<boolean>('conversations-loaded', () => false)

  const { select, insert, update, remove } = useStorage()

  const loadConversations = async () => {
    try {
      const rows = await select<ConversationRow>('conversations', {
        orderBy: 'updatedAt:desc',
      })
      conversations.value = rows.map(conversationFromRow)
    } catch {
      conversations.value = []
    }
    loaded.value = true
  }

  const createConversation = async (params: { title?: string; presetId: string; cwd: string }): Promise<Conversation> => {
    const now = new Date()
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: params.title ?? DEFAULT_TITLE,
      messages: [],
      presetId: params.presetId,
      cwd: params.cwd,
      sessionId: null,
      createdAt: now,
      updatedAt: now,
    }

    await insert('conversations', [{
      id: newConversation.id,
      title: newConversation.title,
      presetId: newConversation.presetId,
      cwd: newConversation.cwd,
      sessionId: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }])

    conversations.value.unshift(newConversation)
    return newConversation
  }

  const updateConversation = async (id: string, updates: Partial<Pick<Conversation, 'title' | 'presetId' | 'cwd' | 'sessionId'>>) => {
    const now = new Date()
    await update('conversations', {
      ...updates,
      updatedAt: now.toISOString(),
    }, { id })

    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      Object.assign(conv, updates, { updatedAt: now })
    }
  }

  const syncConversationTitleFromSession = async (id: string, title: string) => {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      return
    }

    const conversation = conversations.value.find(c => c.id === id)
    if (!conversation) {
      return
    }

    if (conversation.title === normalizedTitle) {
      return
    }

    await updateConversation(id, { title: normalizedTitle })
  }

  const deleteConversation = async (id: string) => {
    await remove('conversations', { id })

    conversations.value = conversations.value.filter(c => c.id !== id)
  }

  return {
    conversations: readonly(conversations),
    loaded: readonly(loaded),
    loadConversations,
    createConversation,
    updateConversation,
    syncConversationTitleFromSession,
    deleteConversation,
  }
}
