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
const route = useRoute()
const router = useRouter()
const drawerOpen = useState<boolean>('drawer-open', () => false)
const settingsSavedAt = useState<number>('settings-saved-at', () => 0)

const conversationId = computed(() => route.params.id as string)

const {
  conversations,
  loaded,
  loadConversations,
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
    await updateConversation(conversationId.value, {})
  },
  onSessionReady: async (sessionId) => {
    await updateConversation(conversationId.value, { sessionId })
  },
  onSessionTitle: async (_sessionId, title) => {
    await syncConversationTitleFromSession(conversationId.value, title)
  },
})

const activeConversationTitle = computed(() => {
  const conv = conversations.value.find(c => c.id === conversationId.value)
  return conv?.title
})

useHead(() => ({
  title: activeConversationTitle.value
    ? `${activeConversationTitle.value} - OpenAgents`
    : 'Chat - OpenAgents',
}))

const initializeConversation = async () => {
  if (!loaded.value) {
    await loadConversations()
  }

  const conversation = conversations.value.find(c => c.id === conversationId.value)
  if (!conversation) {
    await router.push('/new')
    return
  }

  const presetFromQuery = typeof route.query.preset === 'string' ? route.query.preset : null
  const cwdFromQuery = typeof route.query.cwd === 'string' ? route.query.cwd : null

  const presetId = presetFromQuery ?? conversation.presetId
  const cwd = cwdFromQuery ?? conversation.cwd

  if (presetFromQuery || cwdFromQuery) {
    await updateConversation(conversation.id, { presetId, cwd })
    await router.replace({ path: route.path, query: {} })
  }

  start({
    cwd,
    presetId,
    sessionId: conversation.sessionId,
  })
}

watch(conversationId, async () => {
  await initializeConversation()
}, { immediate: true })

watch(settingsSavedAt, () => {
  stop()
})
</script>
