export function useSharedUsers() {
  return useAsyncData('shared', () => $fetch('/api/users'))
}
