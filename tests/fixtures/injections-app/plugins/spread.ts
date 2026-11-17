export default defineNuxtPlugin(() => {
  return { provide: { ...importedProviders } }
})
