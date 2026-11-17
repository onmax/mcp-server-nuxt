export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide('formatPrice', (price: number) => `$${price}`)
})
