<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-[#E5E7EB] shrink-0">
      <button class="w-5 h-5 flex items-center justify-center cursor-pointer" @click="$emit('back')">
        <UIcon name="i-lucide-arrow-left" class="w-5 h-5 text-[#111827]" />
      </button>
      <div class="flex flex-col gap-0.5">
        <h2 class="text-base font-semibold text-[#111827]">{{ toolCall.toolCallTitle || 'Tool Call' }}</h2>
        <span :class="statusClass" class="text-xs">{{ statusText }}</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto flex flex-col gap-5 p-4">
      <!-- Input Arguments -->
      <div v-if="toolCall.toolCallInput" class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-[#374151]">Input Arguments</span>
        <div class="rounded-lg bg-[#1F2937] p-4">
          <pre class="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-[Inter] m-0">{{ formatContent(toolCall.toolCallInput) }}</pre>
        </div>
      </div>

      <!-- Tool Output -->
      <div v-if="toolCall.toolCallOutput" class="flex flex-col gap-2 flex-1 min-h-0">
        <span class="text-[13px] font-semibold text-[#374151]">Tool Output</span>
        <div class="rounded-lg bg-[#1F2937] p-4 flex-1 overflow-y-auto">
          <pre class="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-[Inter] m-0">{{ formatContent(toolCall.toolCallOutput) }}</pre>
        </div>
      </div>

      <!-- Content fallback when no separate input/output -->
      <div v-if="!toolCall.toolCallInput && !toolCall.toolCallOutput && toolCall.content" class="flex flex-col gap-2">
        <span class="text-[13px] font-semibold text-[#374151]">Content</span>
        <div class="rounded-lg bg-[#1F2937] p-4">
          <pre class="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-[Inter] m-0">{{ formatContent(toolCall.content) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessagePart } from '~/types/chat'

interface Props {
  toolCall: ChatMessagePart
}

const props = defineProps<Props>()

defineEmits<{
  back: []
}>()

const statusClass = computed(() => {
  switch (props.toolCall.toolCallStatus) {
    case 'completed': return 'text-[#059669]'
    case 'failed': return 'text-red-600'
    case 'in_progress': return 'text-amber-600'
    default: return 'text-[#6B7280]'
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
