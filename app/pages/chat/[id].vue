<template>
  <ChatPanel
    :messages="messages"
    :status="status"
    :input="input"
    :config-options="configOptions"
    :active-conversation-title="activeConversationTitle"
    @update:input="input = $event"
    @send="sendMessage"
    @stop="stop"
    @clear="clear"
    @respond-permission="respondToPermission"
    @set-config-option="setConfigOption"
    @open-drawer="drawerOpen = true"
    @new-conversation="router.push('/new')"
  />
</template>

<script setup lang="ts">
// Static key: prevent Nuxt from remounting this component when the route param changes
// (e.g. /chat/new → /chat/{sessionId}). The watcher on conversationId handles transitions.
definePageMeta({ key: 'chat' })

const route = useRoute()
const router = useRouter()
const drawerOpen = useState<boolean>('drawer-open', () => false)
const settingsSavedAt = useState<number>('settings-saved-at', () => 0)
const pendingSession = useState<{ preset: string; cwd: string } | null>('pending-session', () => null)
const { settings } = useSettings()

const conversationId = computed(() => route.params.id as string)
const isNew = computed(() => conversationId.value === 'new')

// Tracks the active session to skip re-init on router.replace (new → real ID)
const activeSessionId = ref<string | null>(null)

const {
  conversations,
  loaded,
  loadConversations,
  createConversation,
  updateConversation,
  syncConversationTitleFromSession,
} = useConversations()

const {
  messages,
  status,
  input,
  configOptions,
  sendMessage,
  stop,
  clear,
  start,
  respondToPermission,
  setConfigOption,
} = useChat({
  onUserMessage: async () => {
    if (isNew.value && activeSessionId.value) {
      // First user message in a new session — persist and navigate
      const sid = activeSessionId.value
      const preset = pendingSession.value?.preset ?? settings.value.preset
      await createConversation({ id: sid, preset })
      pendingSession.value = null
      await router.replace(`/chat/${sid}`)
    } else if (!isNew.value) {
      await updateConversation(conversationId.value, {})
    }
  },
  onSessionReady: async (sessionId) => {
    if (isNew.value) {
      // Session is ready but stay on /chat/new until user sends first message
      activeSessionId.value = sessionId
    }
  },
  onSessionTitle: async (_sessionId, title) => {
    // Only sync title after conversation has been persisted (i.e. URL is /chat/{id})
    if (!isNew.value) {
      await syncConversationTitleFromSession(conversationId.value, title)
    }
  },
})

const activeConversationTitle = computed(() => {
  if (isNew.value) return undefined
  const conv = conversations.value.find(c => c.id === conversationId.value)
  return conv?.title
})

useHead(() => ({
  title: isNew.value
    ? 'New Thread - OpenAgents'
    : activeConversationTitle.value
      ? `${activeConversationTitle.value} - OpenAgents`
      : 'Chat - OpenAgents',
}))

const initializeConversation = async () => {
  // Skip re-init when router.replace changed the URL to the already-active session
  if (conversationId.value === activeSessionId.value) {
    return
  }

  // Reset tracking state for genuinely new navigation
  activeSessionId.value = null

  if (isNew.value) {
    // New session: read pending state from /new page, spawn agent immediately
    const pending = pendingSession.value
    if (!pending) {
      // No pending session (e.g. direct URL access / refresh) — back to form
      await router.replace('/new')
      return
    }
    start({ cwd: pending.cwd, presetId: pending.preset })
    return
  }

  // Existing session: load from conversation list
  if (!loaded.value) {
    await loadConversations()
  }

  const conversation = conversations.value.find(c => c.id === conversationId.value)
  if (!conversation) {
    await router.push('/new')
    return
  }

  start({
    cwd: settings.value.defaultCwd || '.',
    presetId: conversation.preset,
    sessionId: conversationId.value,
  })
}

watch(conversationId, async () => {
  await initializeConversation()
}, { immediate: true })

watch(settingsSavedAt, () => {
  stop()
})
</script>
