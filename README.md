# CloudPortal Docs

Publik användardokumentation för CloudPortal-portalen — [docs.coreit.cloud](https://docs.coreit.cloud).

Byggd med [Docus](https://docus.dev) (Nuxt Content + Nuxt UI). All dokumentation är Markdown och vem som helst kan föreslå ändringar via GitHub.

> Detta repo innehåller **endast dokumentation** — ingen applikationskällkod.

## Bidra

Det enklaste sättet att bidra:

1. Öppna sidan du vill ändra på [docs.coreit.cloud](https://docs.coreit.cloud).
2. Klicka **Edit this page** (leder hit till rätt Markdown-fil).
3. Redigera och skapa en pull request.
4. En förhandsvisning byggs automatiskt på PR:en, och en maintainer granskar innan den publiceras.

## Språk

- **Svenska (`sv`)** är källspråk (canonical). Skriv och uppdatera alltid den svenska sidan först.
- **Engelska (`en`)** speglar svenskan och genereras AI-assisterat, men publiceras först efter mänsklig granskning.

Innehåll ligger under `content/<locale>/`:

```
content/
  sv/                       # källspråk
    index.md
    1.kom-igang/ 2.organisation/ 3.domaner-och-dns/ ...
  en/                       # engelsk spegling (samma struktur)
```

URL:er får språkprefix: `/sv/...` och `/en/...`.

## Frontmatter-standard

Varje sida (utom `index.md`) ska ha:

```yaml
---
title: Beställ certifikat
description: Så beställer du ett nytt certifikat i CloudPortal.
audience: customer            # customer | partner
module: certificates
portalArea: certificates
lastVerified: 2026-06-19
sourceLocale: sv
translationKey: certificates.order-certificate   # samma nyckel i sv och en
---
```

Engelska sidor lägger dessutom till `locale: en`, `translationStatus` (`manual | ai-translated | review-required | stale | approved`) och `reviewed: true|false`.

## Säkerhet & innehållsregler

- Dokumentera bara det som syns i kund-/partner-UI eller redan godkänd publik produkttext.
- Exponera **aldrig** interna implementationsdetaljer, databasfält, hemligheter, provider-credentials eller ej lanserade funktioner.
- Skärmdumpar tas alltid från en **demo-organisation** med fejkade domäner, användare och resurser.

## Utveckling

```bash
npm install
npm run dev            # http://localhost:3000
npm run generate       # statisk build -> .output/public
npm run i18n:check     # parity, frontmatter & förbjudna ord
```

## Översättning (maintainers)

Engelska översättningar genereras endast av maintainers:

- GitHub: lägg labeln `ai-translate` på en PR, eller kör workflowen **docs-translate** manuellt.
- Lokalt: `ANTHROPIC_API_KEY=... npm run translate` (lägg till `-- --all` för att tvinga om alla sidor).

Genererade engelska sidor får `reviewed: false` och måste granskas innan de mergas.
