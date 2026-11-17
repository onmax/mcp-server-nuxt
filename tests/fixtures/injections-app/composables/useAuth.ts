export function useAuth() {
  const { $api } = useNuxtApp()
  return $api('/me')
}
