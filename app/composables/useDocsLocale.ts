import { docsPages } from '../docs-map.generated'

/**
 * Resolves the correct counterpart path when slugs are translated per locale
 * (e.g. /sv/certifikat/oversikt ↔ /en/certificates/overview). Docus's default
 * switchLocalePath only swaps the locale prefix, which 404s. We look up the
 * counterpart in the build-time-generated page map (docs-map.generated.ts, from
 * translationKey frontmatter), falling back to switchLocalePath when a page
 * isn't in the map. Synchronous so it's correct during SSR (hreflang) and on the
 * client (switcher). Used by the locale switcher and the hreflang SEO tags.
 */
export function useDocsLocale() {
  const { locale, switchLocalePath } = useDocusI18n()
  const route = useRoute()

  const normalize = (p: string) => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p)

  function localizedPath(code: string): string {
    const current = normalize(route.path)
    const from = locale.value as 'sv' | 'en'
    const to = code as 'sv' | 'en'
    const entry = docsPages.find(p => normalize(p[from]) === current)
    if (entry && entry[to]) return entry[to]
    return (switchLocalePath(code) as string) || `/${code}`
  }

  return { localizedPath }
}
