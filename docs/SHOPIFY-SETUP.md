# 🔌 Shopify app setup — CatalogFlow

**🇬🇧 English** · [🇮🇹 Italiano](SHOPIFY-SETUP.it.md) · [🇫🇷 Français](SHOPIFY-SETUP.fr.md)

---

> ⚡ **Want to skip the 15 minutes?** Let an AI agent do all of this (Claude Code, Cursor,
> Codex…): open **[AI-INSTALL-PROMPT.md](AI-INSTALL-PROMPT.md)**, copy the prompt and answer its
> questions. What follows is the **manual** version, step by step with screenshots.

---

**What this is:** CatalogFlow talks to the Shopify Admin API with an app's **Client ID + Secret**.

You create the app once — about **15 minutes**, no coding — install it on your store, paste two
values into `.env.local`, and you're done.

**Screenshots:** taken from a real Shopify account. The interface is in French (the account's
locale) — your own language shows the same labels in the same places.

**What changed in 2026 (important):** the old *"custom app → copy a permanent `shpat_…` token"*
flow is gone. Shopify now creates apps in the **Dev Dashboard**, which gives you a Client ID and
a Secret. The access token is requested by CatalogFlow itself and renews automatically every
24 hours — so there is no token to copy or rotate by hand.

---

## 1️⃣ Create the app in the Dev Dashboard

**Go to** Shopify admin → **Settings → Apps and sales channels → Develop apps**.

<img src="screenshots/guide/01-shopify-apps-development.png" alt="Settings → Develop apps" width="880">

**Click** *Develop apps in the Dev Dashboard*. This opens `dev.shopify.com` — a separate site,
same login. You'll see the list of apps of your organisation.

<img src="screenshots/guide/02-dev-dashboard-app-list.png" alt="Dev Dashboard app list" width="880">

**Click** *Create app*.

<img src="screenshots/guide/03-create-app-page.png" alt="Create app" width="880">

**Choose** *Start from Dev Dashboard* (not *Start with Shopify CLI*), type a name — for example
`CatalogFlow` — and confirm.

<img src="screenshots/guide/04-app-name-typed.png" alt="App name" width="880">

---

## 2️⃣ Give it the right permissions (scopes)

Shopify immediately asks you to create the **first version** of the app. This is where the API
permissions live.

**The "Create a version" page opens:**

<img src="screenshots/guide/05-create-version-scopes.png" alt="Create version" width="880">

**Scroll to** *API access → Scopes* and enter exactly:

```
read_products,write_products
```

<img src="screenshots/guide/06-api-scopes.png" alt="Scopes" width="880">

> 🔎 `read_products` = read the catalog, `write_products` = edit titles, descriptions, prices,
> sizes and variants, images. CatalogFlow needs nothing else.

**Click** *Publish* (top right or bottom), name the version — for example `1.0.0` — and confirm.

<img src="screenshots/guide/07-publish-version-modal.png" alt="Publish version" width="880">

**The version is now active:**

<img src="screenshots/guide/08-version-published.png" alt="Version published" width="880">

---

## 3️⃣ Install the app on your store (once)

**Back to the app Overview, click** *Install app* — in the *Installations* card.

<img src="screenshots/guide/10-app-overview-install.png" alt="Install app" width="880">

**Shopify asks which store to install it on** — pick yours.

<img src="screenshots/guide/11-store-selection.png" alt="Choose a store" width="880">

**Review the permissions and click** *Install*.

<img src="screenshots/guide/12-install-consent.png" alt="Install consent" width="880">

> ℹ️ Shopify always adds one default permission about *staff and collaborator data* — it has
> nothing to do with CatalogFlow and appears for every app.

**Done — the app appears in your store admin:**

<img src="screenshots/guide/13-app-installed-in-store.png" alt="Installed" width="880">

> ⚠️ Without this step Shopify answers `400 Oauth error app_not_installed` when CatalogFlow
> tries to read the catalog.

---

## 4️⃣ Copy the credentials into `.env.local`

**In the Dev Dashboard open the app →** *App settings* → *Credentials*: you'll find **Client ID**
and **Secret**.

<img src="screenshots/guide/09-credentials.png" alt="Client ID and Secret" width="880">

- Click the copy icon next to each value.

- The Secret is shown in full only once: if you lose it, click *Renew* and copy the new one.

**Paste them into `.env.local`** — the file is created by `cp .env.example .env.local`:

```bash
SHOPIFY_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
```

> 📍 **`SHOPIFY_DOMAIN` must be the `*.myshopify.com` domain**, not your custom domain. You can
> read it in Shopify admin → *Settings → Domains*, or in the address bar of any admin page:
> it's the `xxx-yyy.myshopify.com` form.

**Restart CatalogFlow.** That's it — the app now requests its own 24-hour token and renews it
automatically. No OAuth redirect, no token to paste anywhere else.

---

## 🩺 Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `400 Oauth error app_not_installed` | You skipped step 3 — install the app on your store from the Dev Dashboard |
| `Token exchange fallito (401)` | Wrong Client ID or Secret — copy them again, or *Renew* the secret |
| `Token exchange fallito (404)` | Wrong `SHOPIFY_DOMAIN`: use `xxx-yyy.myshopify.com`, no `https://`, no custom domain |
| `GraphQL error: Access denied for products field` | The published version lacks `read_products`/`write_products` — edit the version, add the scopes, publish and re-install |
| Empty catalog in the interface | The store has no products with the expected status, or the token belongs to another store |
