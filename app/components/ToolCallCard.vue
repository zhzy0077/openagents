<template>
  <div
    class="bg-[#F3F4F6] dark:bg-gray-900 rounded-lg p-3 flex flex-col gap-0 cursor-pointer hover:bg-[#E5E7EB] dark:hover:bg-gray-700 transition-colors md:max-w-full"
    @click="$emit('click')"
  >
    <div class="flex items-center gap-2 mb-1.5">
      <UIcon name="i-lucide-terminal" class="w-3.5 h-3.5 text-[#4B5563] dark:text-gray-400" />
      <span class="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{{ toolCall.toolCallTitle || 'Tool Call' }}</span>
      <div class="flex-1" />
      <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5 text-[#9CA3AF] dark:text-gray-500 shrink-0" />
    </div>
    
    <div class="text-xs text-[#6B7280] dark:text-gray-400 font-mono truncate mb-2">
       {{ toolCall.toolCallInput || toolCall.content }}
    </div>

    <div class="h-px bg-[#E5E7EB] dark:bg-gray-700 w-full my-1"></div>

    <div v-if="toolCall.toolCallStatus === 'completed'" class="text-xs text-[#059669] dark:text-[#10A37F] mt-1">
      ✓ Completed
    </div>
    <div v-else-if="toolCall.toolCallStatus === 'failed'" class="text-xs text-red-600 dark:text-red-400 mt-1">
      Failed
    </div>
    <div v-else class="text-xs text-[#6B7280] dark:text-gray-400 mt-1">
       Running...
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolCallPart } from '~/types/chat'

interface Props {
  toolCall: ToolCallPart
}

defineProps<Props>()

defineEmits<{
  click: []
}>()
</script>
