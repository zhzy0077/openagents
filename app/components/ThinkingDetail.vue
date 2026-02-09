<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-800 transition-colors">
    <!-- Header -->
    <DetailViewHeader @back="$emit('back')">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-brain" class="w-[18px] h-[18px] text-[#6B7280] dark:text-gray-400" />
          <h2 class="text-base font-semibold text-[#111827] dark:text-gray-50">Thinking Process</h2>
        </div>
        <span class="text-xs text-[#059669]">{{ isStreaming ? 'Thinking...' : 'Completed' }}</span>
      </div>
    </DetailViewHeader>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="rounded-lg bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 p-4 h-full">
        <MarkdownContent :content="content" class="text-sm text-[#374151] dark:text-gray-300" />
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
