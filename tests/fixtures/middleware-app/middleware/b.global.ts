export default defineNuxtRouteMiddleware(() => {
  if (!isAdmin()) return abortNavigation('not allowed')
})
