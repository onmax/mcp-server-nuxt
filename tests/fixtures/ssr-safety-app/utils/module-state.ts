const cache = ref<string | null>(null)

export function readCache(): string | null {
  return cache.value
}
