import type { MaybeRefOrGetter } from 'vue'
import { joinURL, withoutTrailingSlash } from 'ufo'

// Overrides Docus's useSeo. Identical behaviour EXCEPT the hreflang alternate
// links are resolved via useDocsLocale (docs-map.json) instead of the naive
// switchLocalePath, which pointed at non-existent /en/<swedish-slug> URLs
// because our slugs are translated per locale. Keep in sync with the upstream
// composable if Docus changes its SEO output.

interface BreadcrumbItem { title: string, path: string }

export interface UseSeoOptions {
  title: MaybeRefOrGetter<string | undefined>
  description: MaybeRefOrGetter<string | undefined>
  type?: MaybeRefOrGetter<'website' | 'article'>
  ogImage?: MaybeRefOrGetter<string | undefined>
  publishedAt?: MaybeRefOrGetter<string | undefined>
  modifiedAt?: MaybeRefOrGetter<string | undefined>
  breadcrumbs?: MaybeRefOrGetter<BreadcrumbItem[] | undefined>
}

export function useSeo(options: UseSeoOptions) {
  const route = useRoute()
  const site = useSiteConfig()
  const { locale, locales, isEnabled: isI18nEnabled } = useDocusI18n()
  const { localizedPath } = useDocsLocale()

  const title = computed(() => toValue(options.title))
  const description = computed(() => toValue(options.description))
  const type = computed(() => toValue(options.type) || 'article')
  const ogImage = computed(() => toValue(options.ogImage))
  const publishedAt = computed(() => toValue(options.publishedAt))
  const modifiedAt = computed(() => toValue(options.modifiedAt))
  const breadcrumbs = computed(() => toValue(options.breadcrumbs))

  const canonicalUrl = computed(() => {
    if (!site.url) return undefined
    return joinURL(site.url, route.path)
  })

  const baseUrl = computed(() => site.url ? withoutTrailingSlash(site.url) : '')

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: type,
    ogUrl: canonicalUrl,
    ogLocale: computed(() => isI18nEnabled.value ? locale.value : undefined),
  })

  useHead({
    link: computed(() => {
      const links: Array<{ rel: string, href?: string, hreflang?: string }> = []

      if (canonicalUrl.value) {
        links.push({ rel: 'canonical', href: canonicalUrl.value })
      }

      // Hreflang tags for i18n — resolved through docs-map so translated slugs
      // produce valid alternate URLs.
      if (isI18nEnabled.value && baseUrl.value) {
        for (const loc of locales) {
          const localePath = localizedPath(loc.code)
          if (localePath) {
            links.push({ rel: 'alternate', hreflang: loc.code, href: joinURL(baseUrl.value, localePath) })
          }
        }

        const defaultLocalePath = localizedPath(locales[0]?.code || 'en')
        if (defaultLocalePath) {
          links.push({ rel: 'alternate', hreflang: 'x-default', href: joinURL(baseUrl.value, defaultLocalePath) })
        }
      }

      return links
    }),
  })

  if (ogImage.value) {
    useSeoMeta({ ogImage: ogImage.value, twitterImage: ogImage.value })
  }

  useHead({
    script: computed(() => {
      const scripts: Array<{ type: string, innerHTML: string }> = []

      if (!baseUrl.value || !title.value) return scripts

      const pageUrl = joinURL(baseUrl.value, route.path)

      if (type.value === 'article') {
        const articleSchema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          'headline': title.value,
          'description': description.value,
          'url': pageUrl,
          'mainEntityOfPage': { '@type': 'WebPage', '@id': pageUrl },
        }
        if (publishedAt.value) articleSchema.datePublished = publishedAt.value
        if (modifiedAt.value) articleSchema.dateModified = modifiedAt.value
        if (site.name) articleSchema.publisher = { '@type': 'Organization', 'name': site.name }
        scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(articleSchema) })
      }

      if (type.value === 'website') {
        const websiteSchema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          'name': site.name || title.value,
          'description': description.value,
          'url': baseUrl.value,
        }
        scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(websiteSchema) })
      }

      if (breadcrumbs.value && breadcrumbs.value.length > 0) {
        const breadcrumbSchema = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          'itemListElement': breadcrumbs.value.map((item, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'name': item.title,
            'item': joinURL(baseUrl.value, item.path),
          })),
        }
        scripts.push({ type: 'application/ld+json', innerHTML: JSON.stringify(breadcrumbSchema) })
      }

      return scripts
    }),
  })
}
