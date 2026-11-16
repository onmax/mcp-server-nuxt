const shared = ref(0)
export const sharedReactive = reactive({ count: 0 })
  const indented = ref('x')

export function useShared() {
  const local = ref(0)
  return { shared, sharedReactive, indented, local }
}
