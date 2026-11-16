export default defineNuxtConfig({
  runtimeConfig: {
    apiSecret: 'top-secret-value',
    sessionKey: '',
    unusedKey: 1,
    db: { host: 'localhost', port: 5432 },
    app: { baseURL: '/' },
    public: {
      appName: 'Fixture App',
      featureFlag: true,
      apiBase: 'https://public.example.com',
      analytics: { id: 'abc' },
    },
  },
})
