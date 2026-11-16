export function useApi() {
  const { db } = useRuntimeConfig()
  return db
}
