<template>
  <!-- Desktop: Modal -->
  <UModal v-if="isDesktop" v-model:open="open" title="Settings" :ui="{ content: 'sm:max-w-[560px]' }">
    <template #body>
      <SettingsForm :draft="draft" />
    </template>

    <template #footer="{ close }">
      <UButton label="Cancel" color="neutral" variant="outline" @click="close" />
      <UButton label="Save Changes" color="primary" @click="handleSave(close)" />
    </template>
  </UModal>

  <!-- Mobile: Bottom Sheet Drawer -->
  <UDrawer v-else v-model:open="open" title="Settings">
    <template #body>
      <SettingsForm :draft="draft" />
    </template>

    <template #footer>
      <UButton label="Save Changes" class="w-full justify-center" color="neutral" @click="handleSave(() => { open = false })" />
    </template>
  </UDrawer>
</template>

<script setup lang="ts">
const { settings, update } = useSettings()

const open = defineModel<boolean>('open', { default: false })

const isDesktop = ref(true)
let mediaQuery: MediaQueryList | null = null

onMounted(() => {
  mediaQuery = window.matchMedia('(min-width: 768px)')
  isDesktop.value = mediaQuery.matches
  const handler = (e: MediaQueryListEvent) => { isDesktop.value = e.matches }
  mediaQuery.addEventListener('change', handler)
  onUnmounted(() => mediaQuery?.removeEventListener('change', handler))
})

const draft = reactive({
  username: '',
  preset: '',
  permissionMode: 'always-ask' as 'always-ask' | 'always-allow',
  defaultCwd: '',
})

watch(open, (isOpen) => {
  if (isOpen) {
    draft.username = settings.value.username
    draft.preset = settings.value.preset
    draft.permissionMode = settings.value.permissionMode
    draft.defaultCwd = settings.value.defaultCwd
  }
})

const emit = defineEmits<{
  saved: []
}>()

const handleSave = (close: () => void) => {
  update({
    username: draft.username.trim() || 'User',
    preset: draft.preset,
    permissionMode: draft.permissionMode,
    defaultCwd: draft.defaultCwd.trim(),
  })
  emit('saved')
  close()
}
</script>
