# Deploy: Cloudflare Pages → docs.coreit.cloud

The site is a static Nuxt build deployed to **Cloudflare Pages**, connected to the
GitHub repo **[oscarcroon/CloudPortalDOCS](https://github.com/oscarcroon/CloudPortalDOCS)**
for automatic production and preview deployments.

## 1. Push to GitHub

- Push this project to the **public** repo `oscarcroon/CloudPortalDOCS`.
- `app.config.ts` (`github.url` / `socials.github`) already points there — this powers
  the **Edit this page** links.

## 2. Connect Cloudflare Pages

In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**:

| Setting              | Value                |
| -------------------- | -------------------- |
| Framework preset     | Nuxt / None          |
| Build command        | `npm run generate`   |
| Build output dir     | `dist`               |
| Node version         | `22` (env `NODE_VERSION=22`) |

> `nuxt generate` writes identical output to both `dist/` and `.output/public` —
> either works as the output dir (verified locally). `dist` matches Cloudflare's Nuxt preset.

- Production branch: `main` → builds on every push.
- Preview deployments: enabled for pull requests (powers the Edit→PR→preview flow).

## 3. Build environment variables (REQUIRED)

In the Pages project → **Settings → Environment variables → Production** (and Preview):

| Variable               | Value                          | Why |
| ---------------------- | ------------------------------ | --- |
| `NUXT_PUBLIC_SITE_URL` | `https://docs.coreit.cloud`    | Makes `sitemap.xml` use absolute URLs and `llms.txt` use the right domain. Without it, Docus falls back to the auto `*.pages.dev` URL (wrong canonical domain). |
| `NODE_VERSION`         | `22`                           | Build runtime. |

> Verified: with `NUXT_PUBLIC_SITE_URL` set, sitemap `<loc>` entries and robots.txt
> resolve to `https://docs.coreit.cloud/...`. Without it the sitemap entries are relative/invalid.

## 4. Custom domain

In the Pages project → **Custom domains** → add `docs.coreit.cloud`.
Since the zone is already on Cloudflare, the CNAME is created automatically and TLS
is provisioned. Verify the site resolves over HTTPS.

## 5. Secrets (for AI translation)

The translation workflow needs an API key. In **repo Settings → Secrets and variables
→ Actions**, add:

- `ANTHROPIC_API_KEY` — used only by the maintainer-triggered `docs-translate` workflow.

Cloudflare Pages does **not** need this secret — translation happens in GitHub Actions,
not at build time.

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
