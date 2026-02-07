<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-[#E5E7EB] shrink-0">
      <button class="w-5 h-5 flex items-center justify-center cursor-pointer" @click="$emit('back')">
        <UIcon name="i-lucide-arrow-left" class="w-5 h-5 text-[#111827]" />
      </button>
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-brain" class="w-[18px] h-[18px] text-[#6B7280]" />
          <h2 class="text-base font-semibold text-[#111827]">Thinking Process</h2>
        </div>
        <span class="text-xs text-[#059669]">{{ isStreaming ? 'Thinking...' : 'Completed' }}</span>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="rounded-lg bg-white border border-[#E5E7EB] p-4 h-full">
        <p class="text-sm text-[#374151] leading-[1.6] whitespace-pre-wrap">{{ content }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  content: string
  isStreaming?: boolean
}

defineProps<Props>()

defineEmits<{
  back: []
}>()
</script>
