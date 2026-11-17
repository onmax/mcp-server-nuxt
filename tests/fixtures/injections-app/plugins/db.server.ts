export default defineNuxtPlugin(() => {
  return {
    provide: {
      db: serverDb()
    }
  }
})
