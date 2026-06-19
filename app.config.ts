export default defineAppConfig({
  // Default locale for the Docus theme UI (matches nuxt.config i18n defaultLocale)
  docus: {
    locale: 'sv',
  },

  seo: {
    titleTemplate: '%s · CoreIT Cloud Docs',
    title: 'CoreIT Cloud Docs',
    description: 'Användardokumentation för CoreIT Cloud-portalen — guider för domäner, DNS, certifikat, e-postsäkerhet, app hosting och partnerhantering.',
  },

  header: {
    title: 'CoreIT Cloud Docs',
    // Drop logo files in public/logo/ and uncomment when available.
    // logo: {
    //   light: '/logo/coreit-light.svg',
    //   dark: '/logo/coreit-dark.svg',
    //   alt: 'CoreIT Cloud',
    // },
  },

  // Powers the "Edit this page" link. Content lives at the repo root in content/,
  // so rootDir is the repo root (omitted). Update url/owner before going public.
  github: {
    url: 'https://github.com/oscarcroon/CloudPortalDOCS',
    branch: 'main',
  },

  socials: {
    github: 'https://github.com/oscarcroon/CloudPortalDOCS',
  },

  toc: {
    title: 'På denna sida',
  },
})
