export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@nuxtjs/i18n'],
  // Public site URL — used by sitemap, robots.txt, canonical links and OG images.
  // Override per-environment with NUXT_PUBLIC_SITE_URL if needed.
  site: {
    url: 'https://docs.coreit.cloud',
    name: 'CoreIT Cloud Docs',
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
