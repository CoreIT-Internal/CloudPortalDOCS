# Cloudflare-uppsättning: docs.coreit.cloud

Detaljerad guide för att publicera den här docs-sajten på **`docs.coreit.cloud`** med
Cloudflare Workers, när domänen `coreit.cloud` **inte** ligger i Cloudflare men du har en
Cloudflare-zon **`coreit.network`**.

Lösningen använder **Cloudflare for SaaS (Custom Hostnames)** med "Worker as origin".

---

## Hur det fungerar (översikt)

```
Besökare → https://docs.coreit.cloud
        │
        │  (CNAME i coreit.cloud:s externa DNS)
        ▼
   coreit.network-zonen i Cloudflare
        │  • Custom Hostname "docs.coreit.cloud" (TLS-cert utfärdas här)
        │  • Worker Route  docs.coreit.cloud/*  →  Worker "coreit-docs"
        ▼
   Worker "coreit-docs"  (serverar ./dist statiskt)
```

- `coreit.cloud` behöver **inte** flyttas till Cloudflare — bara två DNS-poster hos din
  nuvarande leverantör.
- Cloudflare sköter TLS-certifikatet för `docs.coreit.cloud` åt dig.

---

## Begrepp & värden (för just det här projektet)

| Sak | Värde |
| --- | --- |
| Worker-namn | `coreit-docs` (från `wrangler.jsonc`) |
| Cloudflare-zon du äger | `coreit.network` |
| Måldomän (extern) | `docs.coreit.cloud` |
| Fallback origin (hittar du på själv) | `docs-saas.coreit.network` |
| Build-kommando | `npm run generate` |
| Statisk output | `./dist` |

---

## Steg 0 — Förutsättningar

- Repot `oscarcroon/CloudPortalDOCS` är pushat till GitHub.
- Du är inloggad på rätt Cloudflare-konto (det som äger `coreit.network`).
- Zonen `coreit.network` är aktiv (status **Active**) i Cloudflare.

---

## Steg 1 — Deploya Workern

Du behöver en deployad Worker innan den kan kopplas till ett hostnamn. Välj **A** eller **B**.

### A) Git-kopplad auto-deploy (rekommenderas)
1. Cloudflare dashboard → **Compute (Workers)** / **Workers & Pages**
2. **Create** → fliken **Workers** → **Import a repository**
3. Anslut GitHub-kontot **oscarcroon** och välj repot **`CloudPortalDOCS`**
4. Sätt build-inställningar:
   | Fält | Värde |
   | --- | --- |
   | Project name | `coreit-docs` |
   | Production branch | `main` |
   | Build command | `npm run generate` |
   | Deploy command | `npx wrangler deploy` |
5. Lägg till **miljövariabler** (se Steg 5) redan nu
6. **Save and Deploy**

### B) Manuell deploy från din dator
```bash
cd C:\Users\croons\Documents\_dev\coreit-docs
npx wrangler login          # engångsinloggning i webbläsaren
npm run deploy              # = nuxt generate && npx wrangler deploy
```

När det är klart finns Workern på `https://coreit-docs.<ditt-subdomän>.workers.dev`.
Öppna den och kontrollera att `/sv` laddar. (Den här workers.dev-URL:en är bara för test —
den riktiga adressen blir `docs.coreit.cloud`.)

---

## Steg 2 — Aktivera Cloudflare for SaaS på `coreit.network`

1. Dashboard → välj zonen **`coreit.network`**
2. **SSL/TLS → Custom Hostnames**
3. Om det är första gången: följ prompten för att aktivera **Cloudflare for SaaS**
   (första 100 custom hostnames är gratis)

---

## Steg 3 — Skapa en fallback origin

Custom Hostnames behöver en "fallback origin" att peka på. Eftersom en Worker tar hand om
trafiken räcker en *originless* post:

1. I `coreit.network` → **DNS → Records → Add record**
2. Skapa:
   | Type | Name | Target | Proxy |
   | --- | --- | --- | --- |
   | `AAAA` | `docs-saas` | `100::` | **Proxied** (orange moln) |
   > `100::` är en "discard"-adress — ingen riktig server behövs eftersom Workern svarar först.
3. Gå till **SSL/TLS → Custom Hostnames → Fallback Origin**
4. Sätt fallback origin till **`docs-saas.coreit.network`** → spara → vänta tills **Active**

---

## Steg 4 — Lägg till custom hostname `docs.coreit.cloud`

1. **SSL/TLS → Custom Hostnames → Add Custom Hostname**
2. Hostname: **`docs.coreit.cloud`**
3. Certifikat: lämna Cloudflare-hanterat (Universal/SaaS)
4. **Domain Control Validation (DCV):** välj **TXT** (domänen är inte proxad ännu)
5. Spara. Cloudflare visar nu **exakta DNS-poster** du ska lägga in hos coreit.cloud (Steg 6).
   Statusen står som **Pending** tills posterna finns på plats.

---

## Steg 5 — Koppla Workern till hostnamnet (Worker Route)

Så att trafik till `docs.coreit.cloud` körs av Workern:

1. I zonen `coreit.network` → **Workers Routes → Add route**
2. **Route:** `docs.coreit.cloud/*`  ← **specifik**, inte `*/*`
3. **Worker:** välj `coreit-docs`
4. Spara

> ⚠️ Använd **inte** `*/*`. Det skulle skicka **all** trafik på hela `coreit.network` till
> docs-Workern. Mönstret `docs.coreit.cloud/*` matchar bara docs och lämnar resten av zonen ifred.

> Alternativt kan routen läggas i `wrangler.jsonc` så den sätts vid deploy:
> ```jsonc
> "routes": [
>   { "pattern": "docs.coreit.cloud/*", "zone_name": "coreit.network" }
> ]
> ```

### Miljövariabler (sätts på Workern)
**Settings → Variables and Secrets** (eller i build-steget):

| Namn | Värde | Varför |
| --- | --- | --- |
| `NUXT_PUBLIC_SITE_URL` | `https://docs.coreit.cloud` | Korrekt sitemap/canonical/llms-domän |
| `NODE_VERSION` | `22` | Build-runtime |

---

## Steg 6 — DNS-poster hos coreit.cloud (extern leverantör)

Logga in där `coreit.cloud` hanteras (din nuvarande DNS-leverantör, **inte** Cloudflare) och
lägg till de poster Cloudflare visade i Steg 4:

1. **CNAME** för själva trafiken:
   | Type | Name | Value |
   | --- | --- | --- |
   | `CNAME` | `docs` | `docs-saas.coreit.network` |

2. **TXT** för certifikatvalidering (DCV) — exakt namn + värde står i Cloudflare-panelen,
   ungefär:
   | Type | Name | Value |
   | --- | --- | --- |
   | `TXT` | `_cf-custom-hostname.docs` | `<token Cloudflare gav dig>` |

> Kopiera alltid de **exakta** namnen/värdena från Cloudflares Custom-Hostname-vy — de kan
> skilja sig från exemplet ovan.

---

## Steg 7 — Vänta och verifiera

1. Tillbaka i **Custom Hostnames** → statusen för `docs.coreit.cloud` går från **Pending** →
   **Active** när DNS hunnit propagera och certet utfärdats (oftast minuter, ibland upp till en timme)
2. Testa i webbläsaren:
   - **https://docs.coreit.cloud/sv** → svenska startsidan laddar
   - Språkväljaren växlar till `/en`, ⌘K-sök fungerar
   - En undersida, t.ex. **/sv/certifikat/oversikt**
   - **https://docs.coreit.cloud/sitemap.xml** → `<loc>` ska vara absoluta `https://docs.coreit.cloud/...`
   - Hänglåset (giltigt TLS-cert för docs.coreit.cloud)

---

## Felsökning

| Symptom | Trolig orsak / åtgärd |
| --- | --- |
| Custom hostname fastnar på **Pending** | DCV-TXT-posten saknas/fel hos coreit.cloud. Dubbelkolla exakt namn+värde. |
| `525`/TLS-fel | Certet ännu inte utfärdat — vänta, eller kontrollera DCV-posten. |
| `404` på alla sidor | Worker Route saknas eller fel mönster. Verifiera `docs.coreit.cloud/*` → `coreit-docs`. |
| Sidan visar fel/annan tjänst på `coreit.network` | Du använde route `*/*` — ändra till `docs.coreit.cloud/*`. |
| Sitemap har relativa/`*.workers.dev`-URL:er | `NUXT_PUBLIC_SITE_URL` saknas i build-env. Lägg till och deploya om. |
| CNAME går inte att spara hos leverantören | Vissa leverantörer tillåter inte CNAME på en redan använd post — ta bort ev. befintlig `docs`-post först. |

---

## Kostnad

- **Cloudflare for SaaS:** första 100 custom hostnames är gratis → ett hostnamn kostar inget.
- **Workers static assets:** statiska requests är gratis.
- Kontrollera att "Cloudflare for SaaS"-entitlementet är aktiverat på `coreit.network`.

---

## Enklare alternativ (om du vill slippa SaaS)

| Alternativ | Hur | Nackdel |
| --- | --- | --- |
| Flytta `coreit.cloud` till Cloudflare | Byt NS till Cloudflare → `docs.coreit.cloud` blir en vanlig **Worker Custom Domain** (ett klick) | Hela coreit.cloud-zonen måste hanteras i Cloudflare |
| Använd `docs.coreit.network` | Redan i Cloudflare → Worker Custom Domain direkt | Annan domän än önskat |

---

## Efter lansering

- Varje `git push` till `main` triggar ny deploy (om du valde Git-kopplingen i Steg 1).
- "Edit this page"-länkarna fungerar publikt så fort repot `CloudPortalDOCS` är publikt.
- För AI-översättningsflödet: lägg `ANTHROPIC_API_KEY` som **GitHub Actions-secret** (inte i Cloudflare).
