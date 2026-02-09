<script setup lang="ts">
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps<{
  content: string;
}>();

const parsedContent = computed(() => {
  if (!props.content) return '';
  const rawMarkup = marked.parse(props.content, { breaks: true, gfm: true, async: false });
  return DOMPurify.sanitize(rawMarkup as string);
});
</script>

<template>
  <ClientOnly>
    <div class="markdown-content" v-html="parsedContent"></div>
  </ClientOnly>
</template>
