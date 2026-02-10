<template>
  <div class="flex items-center gap-2">
    <template v-if="options && options.length > 0">
      <button
        v-for="opt in options"
        :key="opt.value"
        class="h-8 rounded-md text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5 px-3"
        :class="getButtonClass(opt.value)"
        @click="$emit('respond', opt.value)"
      >
        <UIcon :name="getButtonIcon(opt.value)" class="w-3.5 h-3.5" />
        {{ opt.label }}
      </button>
    </template>
    <template v-else>
      <button
        class="h-8 rounded-md px-3 flex items-center justify-center gap-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium transition-colors"
        @click="$emit('respond', 'always')"
      >
        <UIcon name="i-lucide-repeat-1" class="w-3.5 h-3.5" />
        Always allow
      </button>
      <button
        class="h-8 rounded-md px-4 flex items-center justify-center gap-1.5 bg-[#10A37F] hover:bg-[#059669] text-white text-[13px] font-medium transition-colors"
        @click="$emit('respond', 'yes')"
      >
        <UIcon name="i-lucide-check" class="w-4 h-4" />
        Allow
      </button>
      <button
        class="h-8 rounded-md px-4 flex items-center justify-center gap-1.5 border border-[#D1D5DB] dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-[#374151] dark:text-gray-300 text-[13px] font-medium transition-colors"
        @click="$emit('respond', 'no')"
      >
        <UIcon name="i-lucide-x" class="w-4 h-4 text-[#6B7280] dark:text-gray-400" />
        Reject
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
interface PermissionOption {
  label: string
  value: string
}

interface Props {
  options?: PermissionOption[]
}

defineProps<Props>()

defineEmits<{
  respond: [value: string]
}>()

function isAlwaysAllow(value: string): boolean {
  return value.includes('always')
}

function isReject(value: string): boolean {
  return value.includes('reject') || value.includes('deny') || value === 'no'
}

function getButtonClass(value: string): string {
  if (isAlwaysAllow(value)) {
    return 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs'
  }
  if (isReject(value)) {
    return 'border border-[#D1D5DB] dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-[#374151] dark:text-gray-300'
  }
  return 'bg-[#10A37F] hover:bg-[#059669] text-white'
}

function getButtonIcon(value: string): string {
  if (isAlwaysAllow(value)) return 'i-lucide-repeat-1'
  if (isReject(value)) return 'i-lucide-x'
  return 'i-lucide-check'
}
</script>
