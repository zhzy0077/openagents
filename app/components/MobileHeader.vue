<template>
  <div class="flex md:hidden items-center justify-between px-4 h-14 bg-white dark:bg-gray-800 border-b border-[#E5E7EB] dark:border-gray-700">
    <button class="w-6 h-6 flex items-center justify-center" @click="emit('open-drawer')">
      <UIcon name="i-lucide-menu" class="w-6 h-6 text-[#111827] dark:text-gray-50" />
    </button>
    <span class="text-base font-semibold text-[#111827] dark:text-gray-50">{{ title }}</span>
    <div class="w-5 h-5 flex items-center justify-center">
      <slot name="right">
        <div class="w-6" />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()

const emit = defineEmits<{
  'open-drawer': []
}>()
</script>
