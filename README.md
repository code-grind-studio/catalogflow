# 🛍️ CatalogFlow

**🇬🇧 English** · [🇮🇹 Italiano](README.it.md) · [🇫🇷 Français](README.fr.md)

A **self-hosted web app** to manage a **Shopify product catalog** without clicking through
the admin product by product: browse the whole catalog in one table, edit single products
or dozens at once, fix sizes and variants, clean up images, and share access with a partner.

Built for small stores run by one or two people — no multi-tenant SaaS, no database, no
Shopify App Store listing. You run it on your own machine or on your own server.

**MIT licensed.**

---

## ✨ What it does

- **Whole catalog in one table** — search, filter, see price, status, images and sizes at a glance.

- **Single-product editor** — title, description, price, tags, product type, status.

- **Bulk editing** — apply the same change to a selection of products, with a live progress bar.

- **Sizes and variants** — create, rename, reorder and delete options and variants, per product.

- **Images** — reorder and delete product media.

- **Metafields** — reads and writes `custom.fornitore_url`, `custom.modello`, `custom.gruppo`.

- **Multi-user, password only** — up to 10 accounts defined in env vars, no emails, no database.

- **Activity log** — who changed what, and when (optional Redis persistence).

---

## 🧰 Requirements

- **Node.js 20+** — or Docker, if you prefer (see below)

- A **Shopify store** where you can create an app (any plan)

- **15 minutes** for the one-time Shopify app setup

---

## 🚀 Quick start

```bash
git clone https://github.com/code-grind-studio/catalogflow.git
cd catalogflow
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run dev
```

Open <http://localhost:3000> and log in with the `CATALOG_USER_1_ID` and
`CATALOG_USER_1_PASSWORD` you put in `.env.local`.

> 💡 **On macOS** you can also double-click **`Avvia CatalogFlow.command`**: it installs the
> dependencies on the first run, starts the server and opens the browser.

---

## 🔌 Create the Shopify app (once)

CatalogFlow authenticates with a **Client ID + Client Secret**. You create the app in the
Shopify **Dev Dashboard**, install it on your store, and paste the two values into `.env.local`.

Full walkthrough with screenshots — 13 steps, about 15 minutes:

- 🇬🇧 [**Shopify app setup — English**](docs/SHOPIFY-SETUP.md)

- 🇮🇹 [Configurazione app Shopify — Italiano](docs/SHOPIFY-SETUP.it.md)

- 🇫🇷 [Configuration de l'app Shopify — Français](docs/SHOPIFY-SETUP.fr.md)

Short version: create the app → publish a version with the scopes
`read_products,write_products` → **Install app** on your store → copy **Client ID** and
**Secret** into `.env.local`.

> ⚠️ The install step is not optional: without it Shopify replies
> `400 Oauth error app_not_installed`.

---

## 🔐 Environment variables

| Name | Required | What it is |
|---|---|---|
| `SHOPIFY_DOMAIN` | ✅ yes | your `xxx-yyy.myshopify.com` domain — not the custom domain |
| `SHOPIFY_CLIENT_ID` | ✅ yes | app Client ID (Dev Dashboard → App settings → Credentials) |
| `SHOPIFY_CLIENT_SECRET` | ✅ yes | app Secret (same page — shown in full only once) |
| `CATALOG_USER_1_ID` | ✅ yes | login identifier of the first user |
| `CATALOG_USER_1_PASSWORD` | ✅ yes | password of the first user |
| `CATALOG_USER_1_LABEL` | ➖ no | name shown in the interface (defaults to the ID) |
| `CATALOG_USER_2_ID` … `_10_` | ➖ no | additional users, same three variables (`_ID`, `_PASSWORD`, `_LABEL`) |
| `SESSION_SECRET` | ✅ yes | random string signing the session cookie (`openssl rand -hex 32`) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ➖ no | Upstash Redis REST credentials: keeps the activity log and import progress across restarts |

⏱️ Sessions last **30 minutes**, then the password is asked again.

---

## 🐳 Run with Docker

```bash
cp .env.example .env.local   # fill it in first
docker compose up --build
```

Open <http://localhost:3000>.

The image builds a Next.js standalone server: no Node installation needed on the host, and
it runs on any machine with Docker — NAS, VPS, an old laptop.

---

## ☁️ Deploy (optional)

`scripts/deploy.sh` deploys to **Vercel** and pushes the variables from `.env.local` to the
project (requires `vercel login` once).

Any host that runs Node or Docker works the same way: just set the same environment variables.

---

## ⚙️ How it works

- Every Shopify call happens **server-side**: the browser never sees the Client ID, the
  Secret or the access token.

- The Admin API token is obtained with the **client credentials grant**
  (`POST /admin/oauth/access_token`), cached for 24 hours and renewed automatically — there
  is nothing to copy or rotate by hand.

- Admin API version: **2025-01**. GraphQL throttling is handled with cost-aware retries.

- The login is a signed HMAC cookie (Web Crypto) — no session database.

---

## 🗂️ Project structure

```
src/app/            pages (catalog, login) + API routes
src/lib/catalog/    Shopify client, catalog normalisation, sizes, taxonomy
src/components/     catalog table, product dialogs, selection tray
docs/               setup guides (EN/IT/FR) + screenshots
scripts/            Vercel deploy helper
```

---

## 🩺 Troubleshooting

| Symptom | Fix |
|---|---|
| `400 Oauth error app_not_installed` | install the app on your store — step 3 of the setup guide |
| `Token exchange fallito (404)` | `SHOPIFY_DOMAIN` must be `xxx-yyy.myshopify.com` |
| Login page reloads without entering | `SESSION_SECRET` missing, or the ID/password pair doesn't match |
| Empty catalog | wrong store, or the version was published without `read_products` |

More cases: [docs/SHOPIFY-SETUP.md → Troubleshooting](docs/SHOPIFY-SETUP.md#troubleshooting).

---

## 📄 License

**MIT** — see [LICENSE](LICENSE).

Built by [@code-grind-studio](https://github.com/code-grind-studio).
