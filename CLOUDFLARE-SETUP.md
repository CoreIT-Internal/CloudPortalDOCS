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

- Repot `CoreIT-Internal/CloudPortalDOCS` är pushat till GitHub.
- Du är inloggad på rätt Cloudflare-konto (det som äger `coreit.network`).
- Zonen `coreit.network` är aktiv (status **Active**) i Cloudflare.

---

## Steg 1 — Deploya Workern

> ⚠️ **Använd INTE Cloudflares "Workers Builds" (Git-kopplat bygge).** Docus/Nuxt UI-bygget
> är för tungt för Cloudflares build-container och **timeoutar efter 20 min** (hänger på
> Vite `transforming...`). Bygg i stället där det är snabbt och ladda upp resultatet. Välj **A** eller **B**.

### A) Manuell deploy från din dator (snabbast, alltid pålitlig)
```bash
cd C:\Users\croons\Documents\_dev\coreit-docs
npx wrangler login          # engångsinloggning i webbläsaren (välj kontot som äger coreit.network)
npm run deploy              # = nuxt generate && npx wrangler deploy  (~2 min)
```
Bygger statiskt lokalt och laddar upp `dist` till Workern `cloudportaldocs`.

### B) Auto-deploy via GitHub Actions (rekommenderas — bygger på GitHubs runners, ingen timeout)
Workflowen finns i `.github/workflows/deploy.yml`: den kör `npm ci` → `npm run generate`
→ `wrangler deploy` vid varje push till `main`. Den behöver två repo-secrets. Följ B1–B3.

#### B1 — Hämta ditt Account ID
Cloudflare dashboard → **Workers & Pages** (eller valfri zon-översikt). I högerspalten står
**Account ID** — klicka för att kopiera. (Det är inte hemligt, men workflowen behöver det.)

#### B2 — Skapa en API-token
Dashboard → **My Profile → API Tokens → Create Token**.

Eftersom routen numera hanteras i dashboarden (Steg 5), behöver token **bara** kunna ladda
upp workern. Två varianter:

**Enklast — använd mallen:**
1. Välj mallen **"Edit Cloudflare Workers"** → **Use template**
2. **Account Resources:** Include → ditt konto
3. **Zone Resources:** Include → **coreit.network** (eller "All zones")
4. **Continue to summary → Create Token**
5. **Kopiera token direkt** (visas bara en gång)

**Minimal — egen token (om du vill ge så lite som möjligt):**
1. **Create Custom Token**
2. Permissions:
   - **Account** → **Workers Scripts** → **Edit**
   - *(valfritt men bra)* **Account** → **Account Settings** → **Read**
3. **Account Resources:** Include → ditt konto
4. Continue → Create → kopiera token

> Behöver INTE längre **Workers Routes: Edit** eftersom `wrangler.jsonc` inte sätter någon
> route (den ligger i dashboarden). Om du senare flyttar tillbaka routen till config måste
> token även ha **Zone → Workers Routes: Edit** på `coreit.network`.

#### B3 — Lägg in secrets i GitHub
GitHub → repot **CloudPortalDOCS** → **Settings → Secrets and variables → Actions** →
**New repository secret**, skapa två (namnen måste stämma exakt):

| Secret | Värde |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | token från B2 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID från B1 |

Pusha sedan till `main` (eller kör workflowen manuellt via **Actions → deploy → Run workflow**).
Följ körningen under fliken **Actions**.

> Om du tidigare kopplade repot som en **Workers Build** i Cloudflare: **koppla bort det**
> (Worker `cloudportaldocs` → **Settings → Builds → Disconnect**) så slutar de timeoutande
> byggena trigga parallellt vid varje push.

#### Felsökning av deploy-steget
| Fel i wrangler-steget | Orsak / åtgärd |
| --- | --- |
| `Authentication error [code: 10000]` | Token saknas/fel, eller `CLOUDFLARE_API_TOKEN` felstavat. Kontrollera B2/B3. |
| `Unable to retrieve account ... ` / frågar efter account | `CLOUDFLARE_ACCOUNT_ID` saknas eller fel. |
| `... Workers Routes ...` / route-fel | Token saknar zon-behörighet **eller** en route ligger kvar i `wrangler.jsonc`. Routen ska vara i dashboarden (Steg 5). |
| `workers.dev subdomain ...` | Aktivera en workers.dev-subdomän en gång i dashboarden (Workers & Pages → ditt konto), eller ta bort `"workers_dev": true`. |

När deployen är klar finns Workern på `https://cloudportaldocs.<ditt-subdomän>.workers.dev`.
Öppna den och kontrollera att `/sv` laddar. (Den URL:en är bara för test — den riktiga blir `docs.coreit.cloud`.)

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

Routen hanteras i **dashboarden** (inte i `wrangler.jsonc`), så att `wrangler deploy`
bara laddar upp workern och aldrig behöver zon-behörighet eller bråkar om routes:

1. Zonen `coreit.network` → **Workers Routes → Add route**
2. **Route:** `docs.coreit.cloud/*`  ← **specifik**, inte `*/*`
3. **Worker:** välj `cloudportaldocs`
4. Spara

> ⚠️ Använd **inte** `*/*`. Det skulle skicka **all** trafik på hela `coreit.network` till
> docs-Workern. Mönstret `docs.coreit.cloud/*` matchar bara docs och lämnar resten av zonen ifred.

> Varför inte i `wrangler.jsonc`? En route i config kräver att deploy-token har
> **Zone → Workers Routes: Edit** på `coreit.network` och att hostnamnet redan är aktivt,
> annars failar varje deploy. Att sätta routen en gång i dashboarden frikopplar
> route-livscykeln från workern-deployen.

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
