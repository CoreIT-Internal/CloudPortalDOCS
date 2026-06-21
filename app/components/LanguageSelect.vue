<script setup lang="ts">
// Overrides Docus's built-in LanguageSelect. The default uses switchLocalePath,
// which only swaps the locale prefix on the same slug — that 404s here because
// our slugs are translated (e.g. /sv/certifikat/oversikt ↔ /en/certificates/
// overview). useDocsLocale resolves the counterpart via docs-map.json.
const { locale, locales } = useDocusI18n()
const { localizedPath } = useDocsLocale()

function getEmojiFlag(loc: string): string {
  const languageToCountry: Record<string, string> = { sv: 'se', en: 'gb' }
  const base = loc.split('-')[0]?.toLowerCase() || loc
  const cc = languageToCountry[base] || loc.replace(/^.*-/, '').slice(0, 2)
  return cc.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1A5 + c.charCodeAt(0))).join('')
}
</script>

<template>
  <UPopover :content="{ align: 'end' }">
    <UButton color="neutral" variant="ghost" class="size-8">
      <template #trailing>
        <span class="text-lg">{{ getEmojiFlag(locale) }}</span>
      </template>
    </UButton>

    <template #content>
      <ul class="flex flex-col">
        <li v-for="localeItem in locales" :key="localeItem.code">
          <NuxtLink
            class="flex justify-between py-1.5 px-2 gap-1 hover:bg-muted"
            :to="localizedPath(localeItem.code)"
            :aria-label="localeItem.name"
          >
            <span class="text-sm">{{ localeItem.name }}</span>
            <span class="size-5 text-center">{{ getEmojiFlag(localeItem.code) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </template>
  </UPopover>
</template>
