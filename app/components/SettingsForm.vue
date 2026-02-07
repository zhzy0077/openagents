<template>
  <div class="flex flex-col gap-5">
    <UFormField label="Username">
      <UInput
        v-model="draft.username"
        placeholder="User"
        class="w-full"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
interface Props {
  draft: {
    username: string
    preset: string
  }
}

defineProps<Props>()
</script>
