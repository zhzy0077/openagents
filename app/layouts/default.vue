<template>
  <div class="flex h-screen w-full bg-white overflow-hidden">
    <Transition name="fade">
      <div
        v-if="drawerOpen"
        class="fixed inset-0 bg-black/40 z-40 md:hidden"
        @click="drawerOpen = false"
      />
    </Transition>

    <Transition name="slide">
      <div
        v-show="drawerOpen"
        class="fixed inset-y-0 left-0 z-50 w-[300px] md:hidden"
      >
        <ChatSidebar
          :conversations="conversations"
          :active-conversation-id="activeConversationId"
          @new-conversation="handleNewConversation"
          @select-conversation="handleSelectConversation"
          @delete-conversation="handleDeleteConversation"
          @open-settings="settingsOpen = true; drawerOpen = false"
        />
      </div>
    </Transition>

    <div class="hidden md:block">
      <ChatSidebar
        :conversations="conversations"
        :active-conversation-id="activeConversationId"
        @new-conversation="navigateTo('/new')"
        @select-conversation="(id: string) => navigateTo(`/chat/${id}`)"
        @delete-conversation="handleDeleteConversation"
        @open-settings="settingsOpen = true"
      />
    </div>

    <div class="flex-1 h-full min-w-0">
      <slot />
    </div>

    <SettingsPanel v-model:open="settingsOpen" @saved="handleSettingsSaved" />
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const drawerOpen = useState<boolean>('drawer-open', () => false)
const settingsSavedAt = useState<number>('settings-saved-at', () => 0)
const settingsOpen = ref(false)

const {
  conversations,
  loaded,
  loadConversations,
  deleteConversation,
} = useConversations()

const activeConversationId = computed(() => (route.params.id as string | undefined) ?? null)

onMounted(async () => {
  if (!loaded.value) {
    await loadConversations()
  }
})

const handleNewConversation = async () => {
  drawerOpen.value = false
  await navigateTo('/new')
}

const handleSelectConversation = async (id: string) => {
  drawerOpen.value = false
  await navigateTo(`/chat/${id}`)
}

const handleDeleteConversation = async (id: string) => {
  await deleteConversation(id)
  if (activeConversationId.value === id) {
    await navigateTo('/new')
  }
}

const handleSettingsSaved = () => {
  settingsSavedAt.value = Date.now()
  drawerOpen.value = false
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
