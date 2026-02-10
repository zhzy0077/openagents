import VueFinder from 'vuefinder'
import 'vuefinder/dist/style.css'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueFinder)
})
