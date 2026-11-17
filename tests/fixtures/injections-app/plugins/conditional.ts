export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.client) {
    nuxtApp.provide('device', navigator.userAgent)
  }
})
