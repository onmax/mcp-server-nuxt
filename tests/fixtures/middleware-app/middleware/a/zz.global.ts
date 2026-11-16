export default defineNuxtRouteMiddleware(() => {
  const locale = useState('locale').value
  if (!locale) return navigateTo('/en')
})
