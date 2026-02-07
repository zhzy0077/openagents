<template>
  <div class="flex flex-col w-full md:w-[280px] shrink-0 h-full bg-[#F9FAFB]">
    <!-- New Chat Button -->
    <div class="p-3">
      <button
        class="w-full h-10 bg-white border border-[#E5E7EB] rounded-lg flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm font-medium"
        @click="$emit('new-conversation')"
      >
        <UIcon name="i-lucide-plus" class="w-4 h-4 text-gray-900" />
        <span class="text-sm font-medium text-gray-900">New chat</span>
      </button>
    </div>

    <!-- Threads Section -->
    <div class="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
      <div v-for="(conversations, label) in groupedConversations" :key="label" class="flex flex-col gap-1">
        <div class="text-xs font-medium text-gray-500 px-3 py-1">{{ label }}</div>
        <ConversationItem
          v-for="conversation in conversations"
          :key="conversation.id"
          :conversation="conversation"
          :is-active="conversation.id === activeConversationId"
          @select="$emit('select-conversation', conversation.id)"
          @delete="$emit('delete-conversation', conversation.id)"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="p-3 flex flex-col gap-1 border-t border-[#E5E7EB]">
      <!-- User Profile -->
      <div class="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-[#E5E7EB] rounded-md transition-colors h-auto" @click="$emit('open-settings')">
        <div class="w-8 h-8 rounded-full bg-[#E0E7FF] flex items-center justify-center text-[#4F46E5] text-xs font-semibold">
          {{ userInitials }}
        </div>
        <span class="text-[14px] font-medium text-[#111827] flex-1 truncate">{{ settings.username }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Conversation } from '~/types/chat'

interface Props {
  conversations: readonly Conversation[]
  activeConversationId: string | null
}

const props = defineProps<Props>()

const { settings } = useSettings()

const userInitials = computed(() => {
  const name = settings.value.username || 'User'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

defineEmits<{
  'new-conversation': []
  'select-conversation': [id: string]
  'delete-conversation': [id: string]
  'open-settings': []
}>()

const groupedConversations = computed(() => {
  type ConvItem = typeof props.conversations[number]
  
  const groups = {
    Today: [] as ConvItem[],
    Yesterday: [] as ConvItem[],
    'Previous 7 Days': [] as ConvItem[],
    Older: [] as ConvItem[],
  }
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const lastWeek = today - 86400000 * 7

  // Create a safe copy and sort
  const sorted = [...props.conversations].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  sorted.forEach(c => {
    const d = new Date(c.updatedAt).getTime()
    if (d >= today) groups.Today.push(c)
    else if (d >= yesterday) groups.Yesterday.push(c)
    else if (d >= lastWeek) groups['Previous 7 Days'].push(c)
    else groups.Older.push(c)
  })

  // Filter empty groups and return
  const result: Record<string, ConvItem[]> = {}
  if (groups.Today.length) result.Today = groups.Today
  if (groups.Yesterday.length) result.Yesterday = groups.Yesterday
  if (groups['Previous 7 Days'].length) result['Previous 7 Days'] = groups['Previous 7 Days']
  if (groups.Older.length) result.Older = groups.Older
  
  return result
})
</script>
