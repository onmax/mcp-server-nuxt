export function fetchUser() {
  const app = useNuxtApp()
  app['$api']('/users')
}
