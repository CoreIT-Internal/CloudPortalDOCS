export default defineAppConfig({
  // Default locale for the Docus theme UI (matches nuxt.config i18n defaultLocale)
  docus: {
    locale: 'sv',
  },

  // Same palette as the portal: its brand blue as primary (scale in app/app.css), slate as neutral.
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'slate',
    },
  },

  seo: {
    titleTemplate: '%s · CloudPortal Docs',
    title: 'CloudPortal Docs',
    description: 'Användardokumentation för CloudPortal-portalen — guider för domäner, DNS, certifikat, e-postsäkerhet, app hosting och partnerhantering.',
  },

  header: {
    title: 'CloudPortal Docs',
    // Drop logo files in public/logo/ and uncomment when available.
    // logo: {
    //   light: '/logo/cloudportal-light.svg',
    //   dark: '/logo/cloudportal-dark.svg',
    //   alt: 'CloudPortal',
    // },
  },

  // Powers the "Edit this page" link. Content lives at the repo root in content/,
  // so rootDir is the repo root (omitted). Update url/owner before going public.
  github: {
    url: 'https://github.com/CoreIT-Internal/CloudPortalDOCS',
    branch: 'main',
  },

  socials: {
    github: 'https://github.com/CoreIT-Internal/CloudPortalDOCS',
  },
})
