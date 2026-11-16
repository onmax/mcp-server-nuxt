export function useHome() {
  return useAsyncData('home-composable', () => $fetch('/api/home'))
}
