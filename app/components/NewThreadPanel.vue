<template>
  <div class="flex flex-col h-screen bg-white dark:bg-gray-800 transition-colors">
    <!-- Mobile Header -->
    <MobileHeader title="New Thread" @open-drawer="$emit('open-drawer')" />

    <!-- Content -->
    <div class="flex-1 flex flex-col items-center justify-center pt-8 px-5 pb-5 overflow-y-auto w-full">
      <div class="w-full max-w-[520px] mx-auto flex flex-col gap-6 ">
        <!-- Header -->
        <div class="flex flex-col items-center gap-2">
          <div class="w-12 h-12 rounded-full bg-[#F3F4F6] dark:bg-gray-700 flex items-center justify-center">
            <UIcon name="i-lucide-message-square-plus" class="w-6 h-6 text-[#6B7280] dark:text-gray-400" />
          </div>
          <h1 class="text-[18px] font-semibold text-[#111827] dark:text-gray-50">Start a new thread</h1>
          <p class="text-[13px] text-[#6B7280] dark:text-gray-400 text-center">Choose an agent preset and configure your session</p>
        </div>

        <!-- Preset Selection -->
        <div class="w-full flex flex-col gap-2">
          <label class="text-[13px] font-semibold text-[#374151] dark:text-gray-300">Agent Preset</label>
          <div class="flex flex-col gap-2">
            <button
              v-for="preset in presets"
              :key="preset.id"
              type="button"
              class="w-full rounded-[10px] border-2 p-3.5 text-left transition-colors"
              :class="selectedPreset === preset.id
                ? 'border-[#10A37F] bg-white dark:bg-gray-750'
                : 'border-[#E5E7EB] dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#D1D5DB] dark:hover:border-gray-600'"
              @click="selectedPreset = preset.id"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center"
                    :style="{ backgroundColor: preset.iconBg }"
                  >
                    <UIcon
                      :name="preset.icon"
                      class="w-4 h-4 text-white"
                    />
                  </div>
                  <span class="text-sm font-semibold text-[#111827] dark:text-gray-50">{{ preset.name }}</span>
                </div>
                <UIcon
                  v-if="selectedPreset === preset.id"
                  name="i-lucide-circle-check-big"
                  class="w-[18px] h-[18px] text-[#10A37F] shrink-0"
                />
              </div>
              <p class="text-[13px] text-[#6B7280] dark:text-gray-400 mt-1.5">{{ preset.description }}</p>
            </button>
          </div>
        </div>

        <!-- CWD Input -->
        <div class="w-full flex flex-col gap-2">
          <label class="text-[13px] font-semibold text-[#374151] dark:text-gray-300">Working Directory</label>
          <div class="flex items-center gap-2.5 w-full h-[44px] bg-white dark:bg-gray-800 rounded-lg border border-[#D1D5DB] dark:border-gray-700 px-3.5 focus-within:ring-2 focus-within:ring-[#10A37F] focus-within:border-transparent transition-all">
            <input
              v-model="cwd"
              type="text"
              placeholder="/home/user/projects"
              class="flex-1 bg-transparent border-none outline-none text-sm text-[#111827] dark:text-gray-50 placeholder:text-[#9CA3AF] min-w-0"
              @keydown.enter.prevent="handleStart"
            >
          </div>
        </div>

        <!-- Start Button -->
        <button
          class="w-full h-12 bg-[#10A37F] hover:bg-[#059669] rounded-[10px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mt-4"
          :disabled="!cwd.trim()"
          @click="handleStart"
        >
          <UIcon name="i-lucide-play" class="w-[18px] h-[18px] text-white" />
          <span class="text-[15px] font-semibold text-white">Start Thread</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AGENT_PRESETS } from '~/composables/useSettings'

const emit = defineEmits<{
  start: [presetId: string, cwd: string]
  'open-drawer': []
}>()

const presets = AGENT_PRESETS
const { settings } = useSettings()

const selectedPreset = ref('')
const cwd = ref('')

// Sync from settings after client-side hydration (localStorage unavailable on server)
onMounted(() => {
  selectedPreset.value = settings.value.preset
  cwd.value = settings.value.defaultCwd || ''
})

const handleStart = () => {
  if (!cwd.value.trim()) return
  emit('start', selectedPreset.value, cwd.value.trim())
}
</script>
