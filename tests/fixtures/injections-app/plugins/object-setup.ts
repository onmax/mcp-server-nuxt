export default defineNuxtPlugin({
  setup(ctx) {
    return { provide: { api: makeApi() } }
  }
})
