<template>
  <NewThreadPanel
    @start="handleStart"
    @open-drawer="drawerOpen = true"
  />
</template>

<script setup lang="ts">
const router = useRouter()
const drawerOpen = useState<boolean>('drawer-open', () => false)
const pendingSession = useState<{ preset: string; cwd: string } | null>('pending-session', () => null)

useHead({ title: 'New Thread - OpenAgents' })

const handleStart = (presetId: string, cwd: string) => {
  pendingSession.value = { preset: presetId, cwd }
  router.push('/chat/new')
}
</script>
