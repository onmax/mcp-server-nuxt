export function useRefreshData() {
  const { refresh } = useAsyncData('refresh-key', () => $fetch('/api/refresh'))
  return () => refresh({ dedupe: true })
}
