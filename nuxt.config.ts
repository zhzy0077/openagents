// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  nitro: {
    experimental: {
      websocket: true
    },
    // Mark native modules as external so Rollup/Nitro don't trace or bundle them.
    // At runtime, Node resolves better-sqlite3 from root /app/node_modules/ where
    // the full package (including native .node binary) is installed.
    rollupConfig: {
      external: ['better-sqlite3', 'bindings', 'file-uri-to-path']
    },
    externals: {
      external: ['better-sqlite3', 'bindings', 'file-uri-to-path']
    }
  },
  runtimeConfig: {
    openagentsApiKey: '',
  }
})
