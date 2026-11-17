export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide(computeKey(), 1)
})
