<template>
  <div class="flex flex-col h-screen bg-white dark:bg-gray-800 transition-colors">
    <!-- Detail Views -->
    <ToolCallDetail
      v-if="detailView?.type === 'tool_call'"
      :tool-call="detailView.part"
      @back="detailView = null"
    />
    <ThinkingDetail
      v-else-if="detailView?.type === 'thought'"
      :content="detailView.content"
      :is-streaming="detailView.isStreaming"
      @back="detailView = null"
    />

    <!-- Chat View -->
    <template v-else>
      <!-- Mobile Header -->
      <MobileHeader title="AI Chat" @open-drawer="$emit('open-drawer')">
        <template #right>
          <button class="w-5 h-5 flex items-center justify-center" @click="$emit('new-conversation')">
            <UIcon name="i-lucide-plus" class="w-5 h-5 text-[#111827] dark:text-gray-50" />
          </button>
        </template>
      </MobileHeader>

      <!-- Desktop Header -->
      <div class="hidden md:flex items-center gap-3 px-6 py-4 h-14">
        <UIcon name="i-lucide-chevron-left" class="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-pointer" />
        <h1 class="text-[15px] font-medium text-gray-900 dark:text-gray-50 truncate">
          {{ activeConversationTitle || 'New Chat' }}
        </h1>
      </div>

      <!-- Messages Area -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto py-6 flex flex-col gap-6">
        <!-- Empty State -->
        <div v-if="messages.length === 0 && status === 'ready'" class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div class="w-12 h-12 rounded-full bg-[#10A37F]/10 dark:bg-[#10A37F]/20 flex items-center justify-center">
            <UIcon name="i-lucide-message-circle" class="w-6 h-6 text-[#10A37F] dark:text-[#10A37F]" />
          </div>
          <div class="flex flex-col gap-1">
            <h2 class="text-lg font-medium text-gray-900 dark:text-gray-50">How can I help you today?</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">Send a message to start a conversation.</p>
          </div>
        </div>

        <template v-else>
        <div v-for="message in messages" :key="message.id" class="flex items-center justify-start gap-3 w-full group px-4 md:px-6">
          <!-- Avatar (Desktop Only) -->
          <div 
            class="hidden md:flex w-8 h-8 rounded shrink-0 items-center justify-center text-white text-xs font-medium"
            :class="message.role === 'user' ? 'bg-[#5436DA]' : 'bg-[#10A37F]'"
          >
            {{ message.role === 'user' ? 'U' : 'AI' }}
          </div>

          <!-- Content -->
          <div 
            class="flex flex-col gap-2 min-w-0"
            :class="[
              message.role === 'user' 
                ? 'bg-[#111827] dark:bg-gray-700 text-white rounded-2xl rounded-br-sm p-3 max-w-[85%] md:max-w-none md:flex-1' 
                : 'bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-2xl rounded-bl-sm p-3 max-w-[85%] md:max-w-none md:flex-1'
            ]"
          >
            <!-- Parts Rendering -->
            <template v-if="message.parts && message.parts.length > 0">
              <template v-for="(part, index) in message.parts" :key="index">
                
                <!-- Thought Part -->
                <div
                  v-if="part.type === 'thought'"
                  class="bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-3 flex flex-col gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors md:max-w-full"
                  @click="openThoughtDetail(part)"
                >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-brain" class="w-4 h-4 text-[#9CA3AF] dark:text-gray-500" />
                    <span class="text-[13px] font-medium text-[#6B7280] dark:text-gray-400">Thinking Process</span>
                    <div class="flex-1" />
                    <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5 text-[#9CA3AF] dark:text-gray-500" />
                  </div>
                  <div class="text-xs text-[#9CA3AF] dark:text-gray-500 italic line-clamp-3">{{ part.content }}</div>
                </div>

                <!-- Text Part -->
                <template v-else-if="part.type === 'text'">
                  <MarkdownContent v-if="message.role === 'assistant'" :content="part.content" class="text-sm text-gray-900 dark:text-gray-50" />
                  <div v-else class="text-sm leading-relaxed whitespace-pre-wrap text-white">
                    {{ part.content }}
                  </div>
                </template>

                <!-- Tool Call Part -->
                <ToolCallCard
                  v-else-if="part.type === 'tool_call'"
                  :tool-call="part"
                  @click="openToolCallDetail(part)"
                />

                <!-- Permission Ask Part -->
                <div v-else-if="part.type === 'permission_ask'" class="flex flex-col gap-3 md:max-w-full">
                   <div class="text-[14px] leading-6 font-medium" :class="message.role === 'user' ? 'text-white' : 'text-[#111827] dark:text-gray-50'">{{ part.permissionQuestion || 'I need permission to execute the following command:' }}</div>
                   <div class="bg-[#1F2937] rounded-md p-3 text-xs text-[#E5E7EB] font-mono overflow-x-auto">
                     {{ part.content }}
                   </div>
                   
                   <div v-if="!part.permissionResponse" class="flex flex-col gap-2 w-full">
                     <PermissionButtons
                       :options="part.permissionOptions"
                       @respond="(value) => $emit('respond-permission', part.permissionId!, value)"
                     />
                   </div>
                   <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                     {{ part.permissionResponse === 'yes' ? 'Allowed' : 'Denied' }}
                   </div>
                </div>

              </template>
            </template>

            <!-- Fallback Plain Text -->
            <template v-else>
              <MarkdownContent v-if="message.role === 'assistant'" :content="message.content" class="text-sm text-gray-900 dark:text-gray-50" />
              <div v-else class="text-sm leading-relaxed whitespace-pre-wrap" :class="message.role === 'user' ? 'text-white md:text-gray-900 dark:md:text-gray-50' : 'text-gray-900 dark:text-gray-50'">
                {{ message.content }}
              </div>
            </template>
          </div>
        </div>

        <!-- Typing Indicator -->
        <div v-if="showTypingIndicator" class="flex gap-3 px-4 md:px-6 w-full">
          <div class="hidden md:flex w-8 h-8 rounded bg-[#10A37F] shrink-0 items-center justify-center text-white text-xs font-medium">AI</div>
          <div class="bg-white dark:bg-gray-800 border border-[#E5E7EB] dark:border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 md:bg-transparent md:border-none md:p-0 md:rounded-none flex items-center gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce typing-dot-2"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce typing-dot-3"></div>
          </div>
        </div>
        </template>
      </div>

      <!-- Input Area -->
      <div class="px-4 py-4 md:px-6 md:pt-4 md:pb-6 flex flex-col gap-3 bg-white dark:bg-gray-800 border-t border-[#E5E7EB] dark:border-gray-700 md:border-t-0">
        <div class="w-full min-h-[44px] bg-[#F3F4F6] dark:bg-gray-700 rounded-lg border border-transparent px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#10A37F] focus-within:border-transparent transition-all">
          <UTextarea
            v-model="localInput"
            placeholder="Send a message..."
            :rows="1"
            autoresize
            :disabled="status === 'streaming' || status === 'connecting'"
            variant="none"
            class="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-900 dark:text-gray-50 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            @keydown.enter.exact.prevent="handleSend"
          />
        </div>
        
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <UDropdownMenu v-if="modeOption" :items="modeItems" :ui="{ content: 'max-h-56 overflow-y-auto' }">
              <button class="bg-[#F3F4F6] dark:bg-gray-700 rounded-md px-2 py-1.5 text-xs font-medium text-[#374151] dark:text-gray-300 flex items-center gap-1 hover:bg-[#E5E7EB] dark:hover:bg-gray-600 transition-colors">
                <span class="font-medium">Agent:</span>
                <span>{{ modeLabel }}</span>
                <UIcon name="i-lucide-chevron-down" class="w-3 h-3 text-[#6B7280] dark:text-gray-400" />
              </button>
            </UDropdownMenu>
            <UDropdownMenu v-if="modelOption" :items="modelItems" :ui="{ content: 'max-h-56 overflow-y-auto' }">
              <button class="bg-[#F3F4F6] dark:bg-gray-700 rounded-md px-2 py-1.5 text-xs font-medium text-[#374151] dark:text-gray-300 flex items-center gap-1 hover:bg-[#E5E7EB] dark:hover:bg-gray-600 transition-colors">
                <span class="font-medium">Model:</span>
                <span>{{ modelLabel }}</span>
                <UIcon name="i-lucide-chevron-down" class="w-3 h-3 text-[#6B7280] dark:text-gray-400" />
              </button>
            </UDropdownMenu>
          </div>

          <div class="flex items-center gap-4">
            <UIcon name="i-lucide-paperclip" class="w-4 h-4 text-[#6B7280] dark:text-gray-400 cursor-not-allowed" style="transform: rotate(-135deg)" />
          
            <button
              v-if="status === 'streaming'"
              class="w-9 h-9 shrink-0 bg-[#10A37F] hover:bg-[#059669] rounded-md flex items-center justify-center transition-colors"
              @click="$emit('stop')"
            >
              <UIcon name="i-lucide-square" class="w-4 h-4 text-[#111827] fill-current" />
            </button>
            <button
              v-else
              class="w-9 h-9 shrink-0 bg-[#10A37F] hover:bg-[#059669] rounded-md flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!localInput.trim() || status === 'connecting'"
              @click="handleSend"
            >
              <UIcon name="i-lucide-send" class="w-4 h-4 text-[#111827]" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage, ChatStatus, ChatMessagePart, ToolCallPart } from '~/types/chat'
import type { ConfigOption } from '~/types/acp'

type DetailView =
  | { type: 'tool_call'; part: ToolCallPart }
  | { type: 'thought'; content: string; isStreaming: boolean }

interface Props {
  messages: readonly ChatMessage[]
  status: ChatStatus
  input: string
  configOptions?: readonly ConfigOption[]
  activeConversationTitle?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:input': [value: string]
  send: [message: string]
  stop: []
  clear: []
  'respond-permission': [permissionId: string, response: string]
  'set-config-option': [configId: string, value: string]
  'open-drawer': []
  'new-conversation': []
}>()

const messagesContainer = ref<HTMLElement | null>(null)
const detailView = ref<DetailView | null>(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.status, scrollToBottom)
watch(() => props.messages[props.messages.length - 1]?.parts?.length, scrollToBottom)

const localInput = computed({
  get: () => props.input,
  set: (value: string) => emit('update:input', value)
})

const handleSend = () => {
  if (localInput.value.trim() && props.status !== 'streaming') {
    emit('send', localInput.value)
  }
}

const showTypingIndicator = computed(() => {
  if (props.status !== 'streaming') return false
  const lastMsg = props.messages[props.messages.length - 1]
  if (!lastMsg || lastMsg.role !== 'assistant') return false
  
  // Show if empty content AND (no parts OR (parts exist but only thought parts))
  const isEmptyContent = !lastMsg.content
  const hasOnlyThoughts = lastMsg.parts?.every(p => p.type === 'thought') ?? true
  
  return isEmptyContent && hasOnlyThoughts
})

const openToolCallDetail = (part: ToolCallPart) => {
  detailView.value = { type: 'tool_call', part }
}

const openThoughtDetail = (part: ChatMessagePart) => {
  detailView.value = {
    type: 'thought',
    content: part.content,
    isStreaming: props.status === 'streaming',
  }
}

const modeOption = computed(() => props.configOptions?.find(o => o.category === 'mode'))
const modelOption = computed(() => props.configOptions?.find(o => o.category === 'model'))

const modeLabel = computed(() => {
  const opt = modeOption.value
  if (!opt) return null
  const current = opt.options.find(o => o.value === opt.currentValue)
  return current?.name ?? opt.currentValue
})

const modelLabel = computed(() => {
  const opt = modelOption.value
  if (!opt) return null
  const current = opt.options.find(o => o.value === opt.currentValue)
  return current?.name ?? opt.currentValue
})

const modeItems = computed(() => {
  const opt = modeOption.value
  if (!opt) return []
  return [opt.options.map(o => ({
    label: o.name,
    disabled: o.value === opt.currentValue,
    onSelect: () => emit('set-config-option', opt.id, o.value),
  }))]
})

const modelItems = computed(() => {
  const opt = modelOption.value
  if (!opt) return []
  return [opt.options.map(o => ({
    label: o.name,
    disabled: o.value === opt.currentValue,
    onSelect: () => emit('set-config-option', opt.id, o.value),
  }))]
})
</script>

<style scoped>
.typing-dot-2 {
  animation-delay: 150ms;
}
.typing-dot-3 {
  animation-delay: 300ms;
}
</style>
