<template>
  <div class="flex items-center gap-3 px-4 py-3 border-b border-[#E5E7EB] dark:border-gray-700 shrink-0">
    <button class="w-5 h-5 flex items-center justify-center cursor-pointer" @click="emit('back')">
      <UIcon name="i-lucide-arrow-left" class="w-5 h-5 text-[#111827] dark:text-gray-50" />
    </button>
    <slot />
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  back: []
}>()
</script>
