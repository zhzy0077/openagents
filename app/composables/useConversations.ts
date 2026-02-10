import { readonly } from 'vue'
import { useState } from '#imports'
import type { Conversation } from '#shared/types/chat'
import { AGENT_PRESETS } from './useSettings'
import { useStorage } from './useStorage'

interface ConversationRow {
  id: string
  title: string
  preset?: string
  updatedAt: string
}

const DEFAULT_PRESET_ID = AGENT_PRESETS[0]?.id ?? 'claude-code'
const DEFAULT_TITLE = 'New Chat'

function conversationFromRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    preset: typeof row.preset === 'string' ? row.preset : DEFAULT_PRESET_ID,
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

  const createConversation = async (params: { id: string; title?: string; preset: string }): Promise<Conversation> => {
    const now = new Date()
    const newConversation: Conversation = {
      id: params.id,
      title: params.title ?? DEFAULT_TITLE,
      preset: params.preset,
      updatedAt: now,
    }

    await insert('conversations', [{
      id: newConversation.id,
      title: newConversation.title,
      preset: newConversation.preset,
      updatedAt: now.toISOString(),
    }])

    conversations.value.unshift(newConversation)
    return newConversation
  }

  const updateConversation = async (id: string, updates: Partial<Pick<Conversation, 'title'>> = {}) => {
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
