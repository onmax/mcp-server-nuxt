export default defineNuxtRouteMiddleware(() => {
  if (!useState('user').value) return navigateTo('/login')
})
