# 🛍️ CatalogFlow

**🇬🇧 English** · [🇮🇹 Italiano](README.it.md) · [🇫🇷 Français](README.fr.md)

A **self-hosted web app** to manage a **Shopify product catalog** without clicking through
the admin product by product: browse the whole catalog in one table, edit single products or
dozens at once, fix sizes and variants, clean up images, and share access with a partner.

**MIT licensed.**

---

## ⚡⚡ Install in ~2 minutes (recommended): let Claude Code do it

**Don't do the 15 minutes by hand.** Open **Claude Code** (or Cursor, Codex, Gemini CLI…) in an
empty folder and paste the ready-made prompt: it clones the project, installs the dependencies,
creates `.env.local`, starts the server and walks you through the Shopify app creation, asking
only for the two things it cannot get by itself (Client ID and Secret).

👉 **[Open the prompt: docs/AI-INSTALL-PROMPT.md](docs/AI-INSTALL-PROMPT.md)** — copy it, paste
it, answer the questions. Your time: ~2 minutes instead of 15.

<i>Rather do it by hand? Jump to [🚀 Quick start](#-quick-start) and then to
[🔌 Create the Shopify app](#-create-the-shopify-app-once).</i>

---

## 👥 Who it's for (and who it isn't)

**It's for shops with a big catalog** — hundreds or thousands of products — that need to
**get organised fast** instead of opening and saving one product at a time.

It makes sense especially if:

- 🗂️ you have **hundreds or thousands of products** and scrolling the Shopify admin is already slow

- ✏️ you need to **apply the same change to many products** (titles, descriptions, prices, tags, status)

- 📐 you need to **fix sizes** product by product (rename, reorder, delete variants)

- 🖼️ you need to **clean up the images** of old products

- 👥 there are **two of you** (owner + partner) and each wants their own login, without accounts or emails

**It's not for you if** you have a couple dozen products: the Shopify admin is enough.
It's not a public Shopify App Store app and there is no subscription.

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

- **Node.js 20+** — or Docker, if you already use it (see the bottom of this page)

- A **Shopify store** where you can create an app (any plan)

- **15 minutes** for the one-time Shopify app setup — or ~2 minutes with the AI agent

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

> 💡 **On Windows** double-click **`Avvia CatalogFlow.bat`** — see the Windows section below.

---

## 🪟 On Windows, step by step

No experience needed: five steps, all with the mouse except one.

**1. Install Node.js 20** (once)

Open the Windows **Terminal** (right-click the Start menu → *Terminal* or *PowerShell*) and paste:

```powershell
winget install OpenJS.NodeJS.LTS
```

Close and reopen the terminal, then check with `node -v` (it should answer `v20` or higher).

**2. Download the project**

On the repo's GitHub page: green **Code → Download ZIP**, then unzip the folder wherever you
like (for example in `Documents`). Or, from the command line:

```powershell
git clone https://github.com/code-grind-studio/catalogflow.git
```

**3. Install the dependencies**

Open a **terminal inside the project folder** (open the folder in File Explorer, then right-click
→ *Open in Terminal*) and paste:

```powershell
npm install
```

**4. Create the settings file**

Still in the terminal:

```powershell
copy .env.example .env.local
notepad .env.local
```

Fill in the file with Notepad (leave the `SHOPIFY_*` lines empty until you've done the Shopify
setup):

- `CATALOG_USER_1_ID` and `CATALOG_USER_1_PASSWORD` → the login you'll use
- `SESSION_SECRET` → any long random string; this one is fine:

  ```powershell
  -join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_})
  ```

Save and close Notepad.

**5. Start it**

Double-click **`Avvia CatalogFlow.bat`** in the project folder (or run `npm run dev` from the
terminal). The browser opens on <http://localhost:3000>.

To stop it: close the black terminal window. To start it again tomorrow: double-click the `.bat`
again.

> 🪟 Windows protects your computer: the first time it may ask for firewall permission
> ("Allow access" on private networks) — that's what lets the page answer on `localhost`.

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

## 🐳 Docker (only if you already know it)

> ⚠️ **If you have never used Docker, skip this section**: CatalogFlow doesn't need it. The
> normal start (`npm run dev`, or the launcher file) is simpler and does exactly the same thing
> on your computer.

Docker is only worth it if you want to run it on a machine without installing Node — a NAS, a
rented server, an old laptop:

```bash
cp .env.example .env.local   # fill it in first
docker compose up --build
```

---

## ☁️ Deploy (optional)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcode-grind-studio%2Fcatalogflow&env=SHOPIFY_DOMAIN,SHOPIFY_CLIENT_ID,SHOPIFY_CLIENT_SECRET,CATALOG_USER_1_ID,CATALOG_USER_1_PASSWORD,SESSION_SECRET&envDescription=Shopify+Client+ID%2FSecret+%28see+docs%2FSHOPIFY-SETUP.md%29+and+the+login+user&envLink=https%3A%2F%2Fgithub.com%2Fcode-grind-studio%2Fcatalogflow%2Ftree%2Fmain%2Fdocs)

The button above clones the project into your own Vercel account and asks for the environment
variables one by one (Shopify Client ID/Secret and the login user).

Or from the terminal, inside the project folder:

```bash
bash scripts/deploy.sh     # deploys and pushes the variables from .env.local
```

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
| `npm` not recognised on Windows | Node.js isn't installed, or the terminal needs to be reopened |

More cases: [docs/SHOPIFY-SETUP.md → Troubleshooting](docs/SHOPIFY-SETUP.md#-troubleshooting).

---

## 📄 License

**MIT** — see [LICENSE](LICENSE).

Built by [@code-grind-studio](https://github.com/code-grind-studio).
