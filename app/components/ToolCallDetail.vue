<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors">
    <!-- Header -->
    <DetailViewHeader @back="$emit('back')">
      <div class="flex flex-col gap-0.5">
        <h2 class="text-base font-semibold text-[#111827] dark:text-gray-50">{{ toolCall.toolCallTitle || 'Tool Call' }}</h2>
        <span :class="statusClass" class="text-xs">{{ statusText }}</span>
      </div>
    </DetailViewHeader>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto flex flex-col gap-5 p-4">
      <!-- Input Arguments -->
      <div v-if="toolCall.toolCallInput" class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-[#374151] dark:text-gray-300">Input Arguments</span>
        <div class="rounded-lg bg-[#1F2937] p-4">
          <pre class="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-[Inter] m-0">{{ formatContent(toolCall.toolCallInput) }}</pre>
        </div>
      </div>

      <!-- Tool Output -->
      <div v-if="toolCall.toolCallOutput" class="flex flex-col gap-2 flex-1 min-h-0">
        <span class="text-[13px] font-semibold text-[#374151] dark:text-gray-300">Tool Output</span>
        <div class="rounded-lg bg-[#1F2937] p-4 flex-1 overflow-y-auto">
          <pre class="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-[Inter] m-0">{{ formatContent(toolCall.toolCallOutput) }}</pre>
        </div>
      </div>

      <!-- Content fallback when no separate input/output -->
      <div v-if="!toolCall.toolCallInput && !toolCall.toolCallOutput && toolCall.content" class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-[#374151] dark:text-gray-300">Content</span>
        <div class="rounded-lg bg-[#1F2937] p-4">
          <pre class="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-[Inter] m-0">{{ formatContent(toolCall.content) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolCallPart } from '#shared/types/chat'

interface Props {
  toolCall: ToolCallPart
}

const props = defineProps<Props>()

defineEmits<{
  back: []
}>()

const statusClass = computed(() => {
  switch (props.toolCall.toolCallStatus) {
    case 'completed': return 'text-[#059669] dark:text-[#10A37F]'
    case 'failed': return 'text-red-600 dark:text-red-400'
    case 'in_progress': return 'text-amber-600 dark:text-amber-400'
    default: return 'text-[#6B7280] dark:text-gray-400'
  }
})

const statusText = computed(() => {
  switch (props.toolCall.toolCallStatus) {
    case 'completed': return 'Executed successfully'
    case 'failed': return 'Failed'
    case 'in_progress': return 'Running...'
    case 'pending': return 'Pending'
    default: return ''
  }
})

const formatContent = (content: string): string => {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}
</script>
