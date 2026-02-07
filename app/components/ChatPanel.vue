<template>
  <div class="flex flex-col h-screen bg-white">
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
      <div class="flex md:hidden items-center justify-between px-4 h-14 bg-white border-b border-[#E5E7EB]">
        <button class="w-6 h-6 flex items-center justify-center" @click="$emit('open-drawer')">
          <UIcon name="i-lucide-menu" class="w-6 h-6 text-[#111827]" />
        </button>
        <span class="text-base font-semibold text-[#111827]">AI Chat</span>
        <button class="w-5 h-5 flex items-center justify-center" @click="$emit('new-conversation')">
          <UIcon name="i-lucide-plus" class="w-5 h-5 text-[#111827]" />
        </button>
      </div>

      <!-- Desktop Header -->
      <div class="hidden md:flex items-center gap-3 px-6 py-4 h-14">
        <UIcon name="i-lucide-chevron-left" class="w-5 h-5 text-gray-500 cursor-pointer" />
        <h1 class="text-[15px] font-medium text-gray-900 truncate">
          {{ activeConversationTitle || 'New Chat' }}
        </h1>
      </div>

      <!-- Messages Area -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto py-6 flex flex-col gap-6">
        <!-- Empty State -->
        <div v-if="messages.length === 0 && status === 'ready'" class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div class="w-12 h-12 rounded-full bg-[#10A37F]/10 flex items-center justify-center">
            <UIcon name="i-lucide-message-circle" class="w-6 h-6 text-[#10A37F]" />
          </div>
          <div class="flex flex-col gap-1">
            <h2 class="text-lg font-medium text-gray-900">How can I help you today?</h2>
            <p class="text-sm text-gray-500">Send a message to start a conversation.</p>
          </div>
        </div>

        <template v-else>
        <div v-for="message in messages" :key="message.id" class="flex gap-3 w-full group px-4 md:px-6" :class="message.role === 'user' ? 'justify-end md:justify-start' : 'justify-start'">
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
                ? 'bg-[#111827] text-white rounded-2xl rounded-br-sm p-3 max-w-[85%] md:max-w-none md:bg-transparent md:text-gray-900 md:p-0 md:rounded-none md:flex-1' 
                : 'bg-white border border-[#E5E7EB] md:border-none rounded-2xl rounded-bl-sm p-3 max-w-[85%] md:max-w-none md:bg-transparent md:p-0 md:rounded-none md:flex-1'
            ]"
          >
            <!-- Parts Rendering -->
            <template v-if="message.parts && message.parts.length > 0">
              <template v-for="(part, index) in getSortedParts(message)" :key="index">
                
                <!-- Thought Part -->
                <div
                  v-if="part.type === 'thought'"
                  class="bg-white border border-[#E5E7EB] rounded-xl p-3 flex flex-col gap-2 cursor-pointer hover:bg-gray-50 transition-colors md:max-w-full"
                  @click="openThoughtDetail(part)"
                >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-brain" class="w-4 h-4 text-[#9CA3AF]" />
                    <span class="text-[13px] font-medium text-[#6B7280]">Thinking Process</span>
                    <div class="flex-1" />
                    <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5 text-[#9CA3AF]" />
                  </div>
                  <div class="text-xs text-[#9CA3AF] italic line-clamp-3">{{ part.content }}</div>
                </div>

                <!-- Text Part -->
                <div v-else-if="part.type === 'text'" class="text-sm leading-relaxed whitespace-pre-wrap" :class="message.role === 'user' ? 'text-white md:text-gray-900' : 'text-gray-900'">
                  {{ part.content }}
                </div>

                <!-- Tool Call Part -->
                <div
                  v-else-if="part.type === 'tool_call'"
                  class="bg-[#F3F4F6] rounded-lg p-3 flex flex-col gap-0 cursor-pointer hover:bg-[#E5E7EB] transition-colors md:max-w-full"
                  @click="openToolCallDetail(part)"
                >
                  <div class="flex items-center gap-2 mb-1.5">
                    <UIcon name="i-lucide-terminal" class="w-3.5 h-3.5 text-[#4B5563]" />
                    <span class="text-[13px] font-semibold text-gray-900">{{ part.toolCallTitle || 'Tool Call' }}</span>
                    <div class="flex-1" />
                    <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5 text-[#9CA3AF]" />
                  </div>
                  
                  <div class="text-xs text-[#6B7280] font-mono truncate mb-2">
                     {{ part.toolCallInput || part.content }}
                  </div>

                  <div class="h-px bg-[#E5E7EB] w-full my-1"></div>

                  <div v-if="part.toolCallStatus === 'completed'" class="text-xs text-[#059669] mt-1">
                    ✓ Completed
                  </div>
                  <div v-else-if="part.toolCallStatus === 'failed'" class="text-xs text-red-600 mt-1">
                    Failed
                  </div>
                  <div v-else class="text-xs text-[#6B7280] mt-1">
                     Running...
                  </div>
                </div>

                <!-- Permission Ask Part -->
                <div v-else-if="part.type === 'permission_ask'" class="flex flex-col gap-3 md:max-w-full">
                   <div class="text-[14px] leading-6 font-medium" :class="message.role === 'user' ? 'text-white md:text-[#111827]' : 'text-[#111827]'">{{ part.permissionQuestion || 'I need permission to execute the following command:' }}</div>
                   <div class="bg-[#1F2937] rounded-md p-3 text-xs text-[#E5E7EB] font-mono overflow-x-auto">
                     {{ part.content }}
                   </div>
                   
                   <div v-if="!part.permissionResponse" class="flex flex-col gap-2 w-full">
                     <template v-if="part.permissionOptions && part.permissionOptions.length > 0">
                       <button
                         v-for="opt in part.permissionOptions"
                         :key="opt.value"
                         class="w-full h-9 rounded-lg text-[13px] font-medium transition-colors"
                         :class="opt.value.includes('reject') || opt.value.includes('deny')
                           ? 'bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#374151]'
                           : 'bg-[#10A37F] hover:bg-[#059669] text-white'"
                         @click="$emit('respond-permission', part.permissionId!, opt.value)"
                       >
                         {{ opt.label }}
                       </button>
                     </template>
                     <template v-else>
                       <button 
                         class="w-full h-9 bg-[#10A37F] hover:bg-[#059669] rounded-lg text-white text-[13px] font-medium transition-colors"
                         @click="$emit('respond-permission', part.permissionId!, 'yes')"
                       >
                         Allow
                       </button>
                       <button 
                         class="w-full h-9 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-lg text-[#374151] text-[13px] font-medium transition-colors"
                         @click="$emit('respond-permission', part.permissionId!, 'no')"
                       >
                         Deny
                       </button>
                     </template>
                   </div>
                   <div v-else class="text-sm text-gray-500">
                     {{ part.permissionResponse === 'yes' ? 'Allowed' : 'Denied' }}
                   </div>
                </div>

              </template>
            </template>

            <!-- Fallback Plain Text -->
            <div v-else class="text-sm leading-relaxed whitespace-pre-wrap" :class="message.role === 'user' ? 'text-white md:text-gray-900' : 'text-gray-900'">
              {{ message.content }}
            </div>
          </div>
        </div>

        <!-- Typing Indicator -->
        <div v-if="showTypingIndicator" class="flex gap-3 px-4 md:px-6 w-full">
          <div class="hidden md:flex w-8 h-8 rounded bg-[#10A37F] shrink-0 items-center justify-center text-white text-xs font-medium">AI</div>
          <div class="bg-white border border-[#E5E7EB] rounded-2xl rounded-bl-sm px-4 py-3 md:bg-transparent md:border-none md:p-0 md:rounded-none flex items-center gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce typing-dot-2"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce typing-dot-3"></div>
          </div>
        </div>

        <!-- Active Tool Calls -->
        <div v-if="toolCalls && toolCalls.length > 0" class="flex gap-3 px-4 md:px-6">
          <div class="hidden md:block w-8 h-8 shrink-0"></div>
          <div class="flex-1 min-w-0 flex flex-col gap-2">
            <div
              v-for="(tool, idx) in toolCalls"
              :key="idx"
              class="bg-[#F3F4F6] rounded-lg p-3 flex flex-col gap-0 cursor-pointer hover:bg-[#E5E7EB] transition-colors"
              @click="openToolCallDetail(tool)"
            >
              <div class="flex items-center gap-2 mb-1.5">
                <UIcon name="i-lucide-terminal" class="w-3.5 h-3.5 text-[#4B5563]" />
                <span class="text-[13px] font-semibold text-gray-900">{{ tool.toolCallTitle || 'Tool Call' }}</span>
                <div class="flex-1" />
                <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
              </div>
              
              <div class="text-xs text-[#6B7280] font-mono truncate mb-2">
                 {{ tool.toolCallInput || tool.content }}
              </div>

              <div class="h-px bg-[#E5E7EB] w-full my-1"></div>

              <div class="text-xs text-[#6B7280] mt-1">
                 Running...
              </div>
            </div>
          </div>
        </div>

        <!-- Active Permission Asks -->
        <div v-if="permissionAsks && permissionAsks.length > 0" class="flex gap-3 px-4 md:px-6">
          <div class="hidden md:block w-8 h-8 shrink-0"></div>
          <div class="flex-1 min-w-0 flex flex-col gap-2">
            <div v-for="(ask, idx) in permissionAsks" :key="idx" class="flex flex-col gap-3">
               <div class="text-sm text-gray-900 font-medium">{{ ask.permissionQuestion || 'Permission requested' }}</div>
               <div class="bg-[#1F2937] rounded-md p-3 text-xs text-[#E5E7EB] font-mono overflow-x-auto">
                 {{ ask.content }}
               </div>
               <div class="flex flex-col gap-2 w-full">
                 <template v-if="ask.permissionOptions && ask.permissionOptions.length > 0">
                   <button
                     v-for="opt in ask.permissionOptions"
                     :key="opt.value"
                     class="w-full h-9 rounded-lg text-[13px] font-medium transition-colors"
                     :class="opt.value.includes('reject') || opt.value.includes('deny')
                       ? 'bg-white border border-[#D1D5DB] hover:bg-gray-50 text-[#374151]'
                       : 'bg-[#10A37F] hover:bg-[#059669] text-white'"
                     @click="$emit('respond-permission', ask.permissionId!, opt.value)"
                   >
                     {{ opt.label }}
                   </button>
                 </template>
                 <template v-else>
                   <button 
                     class="w-full h-9 bg-[#10A37F] hover:bg-[#059669] rounded-lg text-white text-[13px] font-medium transition-colors"
                     @click="$emit('respond-permission', ask.permissionId!, 'yes')"
                   >
                     Allow
                   </button>
                   <button 
                     class="w-full h-9 bg-white border border-[#D1D5DB] hover:bg-gray-50 rounded-lg text-[#374151] text-[13px] font-medium transition-colors"
                     @click="$emit('respond-permission', ask.permissionId!, 'no')"
                   >
                     Deny
                   </button>
                 </template>
               </div>
            </div>
          </div>
        </div>
        </template>
      </div>

      <!-- Input Area -->
      <div class="px-4 py-4 md:px-6 md:pt-4 md:pb-6 flex flex-col gap-3 bg-white border-t border-[#E5E7EB] md:border-t-0">
        <div class="w-full min-h-[44px] bg-[#F3F4F6] rounded-lg border border-transparent px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#10A37F] focus-within:border-transparent transition-all">
          <UTextarea
            v-model="localInput"
            placeholder="Send a message..."
            :rows="1"
            autoresize
            :disabled="status === 'streaming' || status === 'connecting'"
            variant="none"
            class="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-gray-900 placeholder:text-gray-500"
            @keydown.enter.exact.prevent="handleSend"
          />
        </div>
        
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <UDropdownMenu v-if="modeOption" :items="modeItems">
              <button class="bg-[#F3F4F6] rounded-md px-2 py-1.5 text-xs font-medium text-[#374151] flex items-center gap-1 hover:bg-[#E5E7EB] transition-colors">
                <span class="font-medium">Agent:</span>
                <span>{{ modeLabel }}</span>
                <UIcon name="i-lucide-chevron-down" class="w-3 h-3 text-[#6B7280]" />
              </button>
            </UDropdownMenu>
            <UDropdownMenu v-if="modelOption" :items="modelItems">
              <button class="bg-[#F3F4F6] rounded-md px-2 py-1.5 text-xs font-medium text-[#374151] flex items-center gap-1 hover:bg-[#E5E7EB] transition-colors">
                <span class="font-medium">Model:</span>
                <span>{{ modelLabel }}</span>
                <UIcon name="i-lucide-chevron-down" class="w-3 h-3 text-[#6B7280]" />
              </button>
            </UDropdownMenu>
          </div>

          <div class="flex items-center gap-4">
            <UIcon name="i-lucide-paperclip" class="w-4 h-4 text-[#6B7280] cursor-not-allowed" style="transform: rotate(-135deg)" />
          
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
import type { ChatMessage, ChatStatus, ChatMessagePart } from '~/types/chat'
import type { ConfigOption } from '~/types/acp'

type DetailView =
  | { type: 'tool_call'; part: ChatMessagePart }
  | { type: 'thought'; content: string; isStreaming: boolean }

interface Props {
  messages: readonly ChatMessage[]
  status: ChatStatus
  input: string
  toolCalls?: readonly ChatMessagePart[]
  permissionAsks?: readonly ChatMessagePart[]
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

const localInput = computed({
  get: () => props.input,
  set: (value: string) => emit('update:input', value)
})

const handleSend = () => {
  if (localInput.value.trim() && props.status !== 'streaming') {
    emit('send', localInput.value)
  }
}

const getSortedParts = (message: ChatMessage) => {
  if (!message.parts) return []
  // Order: thought, then others
  return [...message.parts].sort((a, b) => {
    if (a.type === 'thought' && b.type !== 'thought') return -1
    if (a.type !== 'thought' && b.type === 'thought') return 1
    return 0
  })
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

const openToolCallDetail = (part: ChatMessagePart) => {
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
    click: () => emit('set-config-option', opt.id, o.value),
  }))]
})

const modelItems = computed(() => {
  const opt = modelOption.value
  if (!opt) return []
  return [opt.options.map(o => ({
    label: o.name,
    disabled: o.value === opt.currentValue,
    click: () => emit('set-config-option', opt.id, o.value),
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
