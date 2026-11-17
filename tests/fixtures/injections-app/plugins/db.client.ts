export default defineNuxtPlugin(() => {
  return {
    provide: {
      db: clientDb()
    }
  }
})
