const helper = { provide() {} }

export default defineNuxtPlugin((nuxtApp) => {
  helper.provide('fake', 1)
  nuxtApp.provide('real', 1)
})
