<template>
  <div class="flex flex-col gap-2 w-full">
    <template v-if="options && options.length > 0">
      <button
        v-for="opt in options"
        :key="opt.value"
        class="w-full h-9 rounded-lg text-[13px] font-medium transition-colors"
        :class="opt.value.includes('reject') || opt.value.includes('deny')
          ? 'bg-white dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-[#374151] dark:text-gray-300'
          : 'bg-[#10A37F] hover:bg-[#059669] text-white'"
        @click="$emit('respond', opt.value)"
      >
        {{ opt.label }}
      </button>
    </template>
    <template v-else>
      <button 
        class="w-full h-9 bg-[#10A37F] hover:bg-[#059669] rounded-lg text-white text-[13px] font-medium transition-colors"
        @click="$emit('respond', 'yes')"
      >
        Allow
      </button>
      <button 
        class="w-full h-9 bg-white dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-[#374151] dark:text-gray-300 text-[13px] font-medium transition-colors"
        @click="$emit('respond', 'no')"
      >
        Deny
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
</script>
