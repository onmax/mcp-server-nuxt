export function analyticsId(): string {
  return useRuntimeConfig()['public']['analytics']['id']
}

export function nested(): string {
  return useRuntimeConfig().public.missingKey
}
