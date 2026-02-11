<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-800">
    <!-- Header -->
    <div class="flex items-center gap-3 h-14 px-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <button
        class="md:hidden p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        @click="drawerOpen = true"
      >
        <UIcon name="i-lucide-menu" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>
      <UIcon name="i-lucide-folder" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
      <h1 class="text-base font-semibold text-gray-900 dark:text-gray-50">File System</h1>
    </div>

    <!-- VueFinder -->
    <div class="flex-1 min-h-0 overflow-auto">
      <ClientOnly>
        <vue-finder
          id="openagents-files"
          :driver="driver"
          :config="{
            initialPath: 'local://',
            persist: true,
            theme: colorMode.value === 'dark' ? 'valorite' : 'silver',
          }"
        />
        <template #fallback>
          <div class="flex items-center justify-center h-full text-gray-400">
            Loading file manager...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RemoteDriver } from 'vuefinder'

useHead({ title: 'File System - OpenAgents' })

const drawerOpen = useState<boolean>('drawer-open', () => false)
const colorMode = useColorMode()

const driver = new RemoteDriver({
  baseURL: '/api/files',
  url: {
    list: '/',
    upload: '/upload',
    delete: '/delete',
    rename: '/rename',
    copy: '/copy',
    move: '/move',
    archive: '/archive',
    unarchive: '/unarchive',
    createFile: '/create-file',
    createFolder: '/create-folder',
    preview: '/preview',
    download: '/download',
    search: '/search',
    save: '/save',
  },
})
</script>
