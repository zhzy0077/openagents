<template>
  <div
    class="group flex w-full h-9 items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#E5E7EB] transition-colors rounded-md"
    :class="{ 'bg-[#E5E7EB]': isActive }"
    @click="$emit('select')"
  >
    <UIcon name="i-lucide-message-circle" class="w-3.5 h-3.5 text-gray-500 shrink-0" />
    <span class="text-[13px] font-normal text-gray-900 truncate flex-1 leading-none">
      {{ conversation.title }}
    </span>
    <button
      class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 text-gray-400 transition-opacity"
      @click.stop="$emit('delete')"
    >
      <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Conversation } from '~/types/chat'

interface Props {
  conversation: Conversation
  isActive?: boolean
}

defineProps<Props>()

defineEmits<{
  select: []
  delete: []
}>()
</script>
