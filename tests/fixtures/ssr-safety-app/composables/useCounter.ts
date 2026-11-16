export function useCounter() {
  const count = ref(0)
  const state = reactive({ count: 0 })
  return { count, state }
}
