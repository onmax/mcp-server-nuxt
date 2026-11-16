export default defineNuxtConfig({
  generate: { routes: ['/sitemap.xml'] },
  experimental: {
    treeshakeClientOnly: true,
    configSchema: true,
  },
  vite: {
    devBundler: 'legacy',
  },
  hooks: {
    'pages:extend'(pages) {
      const home = pages.find((page) => page.path === '/')
      home.meta.layout = 'overridden'
    },
  },
})
