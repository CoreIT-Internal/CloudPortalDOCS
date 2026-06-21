interface PagePair { key: string, sv: string, en: string }

/**
 * Resolves the correct counterpart path when slugs are translated per locale
 * (e.g. /sv/certifikat/oversikt ↔ /en/certificates/overview). Docus's default
 * switchLocalePath only swaps the locale prefix, which 404s. We look up the
 * counterpart in docs-map.json (a full sv↔en page map generated from
 * translationKey frontmatter), falling back to switchLocalePath when a page
 * isn't in the map. Used by both the locale switcher and the hreflang SEO tags.
 */
export function useDocsLocale() {
  const { locale, switchLocalePath } = useDocusI18n()
  const route = useRoute()

  // Non-lazy so SSR/prerender awaits it → hreflang links are correct in static
  // HTML. Shared key dedupes the fetch across components.
  const { data } = useFetch<{ pages: PagePair[] }>('/docs-map.json', {
    key: 'docs-map-pages',
    default: () => ({ pages: [] }),
  })

  const normalize = (p: string) => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p)

  function localizedPath(code: string): string {
    const current = normalize(route.path)
    const from = locale.value as 'sv' | 'en'
    const to = code as 'sv' | 'en'
    const entry = data.value?.pages?.find(p => normalize(p[from]) === current)
    if (entry && entry[to]) return entry[to]
    return (switchLocalePath(code) as string) || `/${code}`
  }

  return { localizedPath }
}
