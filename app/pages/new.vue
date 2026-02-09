<template>
  <NewThreadPanel
    @start="handleStartThread"
    @open-drawer="drawerOpen = true"
  />
</template>

<script setup lang="ts">
useHead({
  title: 'New Thread - OpenAgents',
})

const router = useRouter()
const drawerOpen = useState<boolean>('drawer-open', () => false)

const { createConversation } = useConversations()

const handleStartThread = async (presetId: string, cwd: string) => {
  const newConversation = await createConversation({ presetId, cwd })
  await router.push(`/chat/${newConversation.id}`)
}
</script>
