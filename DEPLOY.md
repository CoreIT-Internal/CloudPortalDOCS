# Deploy: Cloudflare → docs.coreit.cloud

The site is a **fully static** Nuxt build (`nuxt generate` → `./dist`, no server runtime),
deployed from the GitHub repo
**[oscarcroon/CloudPortalDOCS](https://github.com/oscarcroon/CloudPortalDOCS)**.

As of 2026 Cloudflare positions **Workers (static assets)** as the default for new
projects (Pages is still supported but no longer the steered path). This project ships a
`wrangler.jsonc` for the **Workers** path. The legacy **Pages** path also works — see the
alternative at the bottom.

## 1. Push to GitHub

- Push this project to `oscarcroon/CloudPortalDOCS`.
- `app.config.ts` (`github.url` / `socials.github`) already points there — this powers
  the **Edit this page** links. (Repo must be **public** for external edit links to work.)

## 2. Deploy via Cloudflare Workers (recommended)

`wrangler.jsonc` declares an assets-only Worker serving `./dist`:

```jsonc
{
  "name": "cloudportaldocs",
  "compatibility_date": "2026-06-19",
  "assets": { "directory": "./dist", "not_found_handling": "404-page" },
  "workers_dev": true
}
```

> ⚠️ Do **not** use Cloudflare's own "Workers Builds" (Git-connected build) — the
> Docus/Nuxt UI build is too heavy for its container and times out (~20 min). Build
> elsewhere and upload.

**Option A — GitHub Actions (recommended, auto-deploy on push):**
`.github/workflows/deploy.yml` builds on GitHub's runners and deploys via wrangler.
Set the two repo secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) — full
token/secret steps are in **[CLOUDFLARE-SETUP.md](./CLOUDFLARE-SETUP.md) → Steg 1 B**.

**Option B — Manual deploy from your machine:**
```bash
npx wrangler login    # one-time
npm run deploy        # = nuxt generate && npx wrangler deploy
```

`nuxt generate` writes identical output to `dist/` and `.output/public`; `wrangler.jsonc`
points at `dist`. The custom hostname route is managed in the dashboard (not in config).

## 3. Build environment variables (REQUIRED)

In the Pages project → **Settings → Environment variables → Production** (and Preview):

| Variable               | Value                          | Why |
| ---------------------- | ------------------------------ | --- |
| `NUXT_PUBLIC_SITE_URL` | `https://docs.coreit.cloud`    | Makes `sitemap.xml` use absolute URLs and `llms.txt` use the right domain. Without it, Docus falls back to the auto `*.workers.dev` / `*.pages.dev` URL (wrong canonical domain). |
| `NODE_VERSION`         | `22`                           | Build runtime. |

> Verified: with `NUXT_PUBLIC_SITE_URL` set, sitemap `<loc>` entries and robots.txt
> resolve to `https://docs.coreit.cloud/...`. Without it the sitemap entries are relative/invalid.

## 4. Custom domain

**If `docs.coreit.cloud`'s zone (`coreit.cloud`) is in your Cloudflare account:**
Workers project → **Settings → Domains & Routes → Add → Custom Domain** → `docs.coreit.cloud`.
DNS record + TLS are provisioned automatically.

**If `coreit.cloud` is NOT in Cloudflare (current case):** the domain is served via
**Cloudflare for SaaS (Custom Hostnames)** through the `coreit.network` zone. See the
detailed step-by-step in **[CLOUDFLARE-SETUP.md](./CLOUDFLARE-SETUP.md)**.

## 5. Secrets (for AI translation)

The translation workflow needs an API key. In **repo Settings → Secrets and variables
→ Actions**, add:

- `ANTHROPIC_API_KEY` — used only by the maintainer-triggered `docs-translate` workflow.

Cloudflare does **not** need this secret — translation happens in GitHub Actions,
not at build/deploy time.

## 6. llms.txt / MCP

- Once `NUXT_PUBLIC_SITE_URL` is set, Docus generates `llms.txt` and `llms-full.txt`
  (a full-text dump for AI crawlers). This exposes ALL published content — fine given
  v1 publishes with a "machine-translated, pending review" notice on English pages, but
  be aware unreviewed English drafts are included. To suppress, remove the domain or
  disable `nuxt-llms`.
- The `/mcp` endpoint only runs on the dev server; it is **not** emitted in the static
  build, so it is not exposed on Cloudflare.

## Notes on content state at launch

- English detail pages are AI-translated drafts (`reviewed: false`) and carry a visible
  machine-translation notice. Swedish is the authoritative source.
- Open content decisions tracked separately: whether to document the `_coreid` autodiscover
  record, real support contact details, and partner terminology.

## Alternative: deploy via Cloudflare Pages (legacy path)

Pages still works for static sites. Dashboard → **Workers & Pages → Create → Pages →
Connect to Git** → `oscarcroon/CloudPortalDOCS`:

| Setting          | Value              |
| ---------------- | ------------------ |
| Framework preset | Nuxt / None        |
| Build command    | `npm run generate` |
| Build output dir | `dist`             |
| Node version     | `22`               |

Set the same `NUXT_PUBLIC_SITE_URL` env var. Pages also gives per-PR preview deployments
out of the box. `wrangler.jsonc` is ignored by the Pages flow.
