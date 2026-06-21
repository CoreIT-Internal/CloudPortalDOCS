export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@nuxtjs/i18n'],
  // Force a pure static build everywhere. Without this, Cloudflare's build
  // environment auto-detects and switches Nitro to the `cloudflare-module` (SSR)
  // preset, which makes @nuxt/content demand a D1 database. We deploy the
  // prerendered output as Workers static assets (see wrangler.jsonc), so keep it static.
  nitro: {
    preset: 'static',
  },
  // Public site URL — used by sitemap, robots.txt, canonical links and OG images.
  // Override per-environment with NUXT_PUBLIC_SITE_URL if needed.
  site: {
    url: 'https://docs.coreit.cloud',
    name: 'CloudPortal Docs',
  },
  i18n: {
    defaultLocale: 'sv',
    locales: [{
      code: 'sv',
      name: 'Svenska',
    }, {
      code: 'en',
      name: 'English',
    }],
  },
})
