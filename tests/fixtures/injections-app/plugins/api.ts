export default defineNuxtPlugin(() => {
  return {
    provide: {
      api: createApi(),
      toast
    }
  }
})
