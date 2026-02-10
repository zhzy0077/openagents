<template>
  <div class="flex flex-col gap-5">
    <UFormField label="Default Agent">
      <USelect
        v-model="draft.preset"
        :items="presetOptions"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Username">
      <UInput
        v-model="draft.username"
        placeholder="User"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Permission Mode">
      <USelect
        v-model="draft.permissionMode"
        :items="permissionModeOptions"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Default Working Directory">
      <UInput
        v-model="draft.defaultCwd"
        placeholder="/home/user/projects"
        class="w-full"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import { AGENT_PRESETS, type PermissionMode } from '~/composables/useSettings'

const draft = defineModel<{
  username: string
  preset: string
  permissionMode: PermissionMode
  defaultCwd: string
}>('draft', { required: true })

const presetOptions = AGENT_PRESETS.map(p => ({
  label: p.name,
  value: p.id,
}))

const permissionModeOptions = [
  { label: 'Always ask', value: 'always-ask' },
  { label: 'Always allow', value: 'always-allow' },
]
</script>
