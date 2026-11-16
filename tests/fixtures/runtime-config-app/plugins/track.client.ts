export default defineNuxtPlugin(() => {
  const { sessionKey } = useRuntimeConfig()
  track(sessionKey)
})
