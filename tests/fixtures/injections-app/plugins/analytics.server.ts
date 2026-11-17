export default defineNuxtPlugin(() => {
  return {
    provide: {
      analytics: track
    }
  }
})
