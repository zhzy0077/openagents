<template>
  <div class="flex flex-col gap-3">
    <!-- Header: granted or denied -->
    <div class="flex items-center gap-2">
      <UIcon
        :name="granted ? 'i-lucide-check' : 'i-lucide-x'"
        class="w-3.5 h-3.5"
        :class="granted ? 'text-[#059669]' : 'text-[#DC2626]'"
      />
      <span
        class="text-xs font-semibold"
        :class="granted
          ? 'text-[#059669] dark:text-[#10B981]'
          : 'text-[#DC2626] dark:text-[#EF4444]'"
      >
        {{ granted ? 'Permission granted' : 'Permission denied' }}
      </span>
    </div>

    <!-- Tool box -->
    <div
      class="rounded-lg p-3 flex flex-col gap-2"
      :class="granted
        ? 'bg-[#F0FDF4] dark:bg-[#064E3B]'
        : 'bg-[#FEF2F2] dark:bg-[#450A0A]'"
    >
      <!-- Tool header row -->
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-terminal"
          class="w-3.5 h-3.5 shrink-0"
          :class="granted ? 'text-[#059669]' : 'text-[#DC2626]'"
        />
        <span
          v-if="toolName"
          class="text-xs font-semibold"
          :class="granted ? 'text-[#059669]' : 'text-[#DC2626]'"
        >
          {{ toolName }}
        </span>
        <div
          v-if="toolName && command"
          class="w-px h-3 shrink-0"
          :class="granted ? 'bg-[#059669]/30' : 'bg-[#DC2626]/30'"
        />
        <span v-if="command" class="text-xs text-[#374151] dark:text-gray-300 font-mono truncate">
          {{ command }}
        </span>
      </div>

      <!-- Output / Reason text -->
      <div
        v-if="resultText"
        class="text-xs leading-relaxed"
        :class="granted
          ? 'text-[#166534] dark:text-[#D1FAE5]'
          : 'text-[#991B1B] dark:text-[#FEE2E2]'"
      >
        {{ resultText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  granted: boolean
  toolName?: string
  command?: string
  resultText?: string
}

defineProps<Props>()
</script>
