export default defineNuxtPlugin(() => {
  const { apiSecret } = useRuntimeConfig()
  serverOnly(apiSecret)
})
