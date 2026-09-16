# Shopify app setup — CatalogFlow

**What this is:** CatalogFlow talks to the Shopify Admin API with an app's **Client ID + Secret**.
You create the app once (≈ 15 minutes, no coding), install it on your store, paste two values
into `.env.local` and you're done.

**Screenshots:** taken from a real Shopify account. The interface is in French
(the reviewer's locale) — your own language shows the same labels in the same places.

**What changed in 2026 (important):** the old "custom app → copy a permanent
`shpat_…` token" flow is gone. Shopify now creates apps in the **Dev Dashboard**, which
gives you a Client ID and a Secret; the access token is requested by CatalogFlow itself
and renews automatically (24 h), so there is no token to copy or rotate by hand.

---

## 1. Create the app in the Dev Dashboard

1. In Shopify admin go to **Settings → Apps and sales channels → Develop apps**.

   ![Settings → Develop apps](screenshots/guide/01-shopify-apps-development.png)

2. Click **Develop apps in the Dev Dashboard**. This opens `dev.shopify.com` (a separate
   site, same login). You'll see the list of apps of your organisation.

   ![Dev Dashboard app list](screenshots/guide/02-dev-dashboard-app-list.png)

3. Click **Create app**.

   ![Create app](screenshots/guide/03-create-app-page.png)

4. Choose **Start from Dev Dashboard** (not "Start with Shopify CLI"), type a name —
   e.g. `CatalogFlow` — and confirm.

   ![App name](screenshots/guide/04-app-name-typed.png)

## 2. Give it the right permissions (scopes)

Shopify immediately asks you to create the **first version** of the app. This is where
the API permissions live.

1. The "Create a version" page opens:

   ![Create version](screenshots/guide/05-create-version-scopes.png)

2. Scroll to **API access → Scopes** and enter exactly:

   ```
   read_products,write_products
   ```

   ![Scopes](screenshots/guide/06-api-scopes.png)

   > `read_products` = read the catalog, `write_products` = edit titles, descriptions,
   > prices, sizes/variants, images. CatalogFlow needs nothing else.

3. Click **Publish** (top right or bottom), name the version (e.g. `1.0.0`) and confirm.

   ![Publish version](screenshots/guide/07-publish-version-modal.png)

4. The version is now active:

   ![Version published](screenshots/guide/08-version-published.png)

## 3. Install the app on your store (once)

1. Go back to the app **Overview** and click **Install app** (in the *Installations* card).

   ![Install app](screenshots/guide/10-app-overview-install.png)

2. Shopify asks which store to install it on — pick yours.

   ![Choose a store](screenshots/guide/11-store-selection.png)

3. Review the permissions and click **Install**.

   ![Install consent](screenshots/guide/12-install-consent.png)

   > Shopify always adds one default permission about *staff/collaborator data* — it is
   > unrelated to CatalogFlow and shows up for every app.

4. Done — the app appears in your store admin:

   ![Installed](screenshots/guide/13-app-installed-in-store.png)

   Without this step Shopify answers `400 Oauth error app_not_installed` when CatalogFlow
   tries to read the catalog.

## 4. Copy the credentials into `.env.local`

1. In the Dev Dashboard open the app → **App settings** (*Paramètres de l'appli*) →
   **Credentials** (*Identifiants*): you'll find **Client ID** and **Secret**.

   ![Client ID and Secret](screenshots/guide/09-credentials.png)

   - Click the copy icon next to each value.
   - The Secret is shown in full only once: if you lose it, click **Renew** and copy the
     new one.

2. Paste them into `.env.local` (the file is created by `cp .env.example .env.local`):

   ```bash
   SHOPIFY_DOMAIN=your-store.myshopify.com
   SHOPIFY_CLIENT_ID=...
   SHOPIFY_CLIENT_SECRET=...
   ```

   > **`SHOPIFY_DOMAIN` must be the `*.myshopify.com` domain**, not your custom domain.
   > You can read it in Shopify admin → Settings → Domains (or in the address bar of any
   > admin page: it's the `xxx-yyy.myshopify.com` form).

3. Restart CatalogFlow. That's it: the app now requests its own 24 h token and renews it
   automatically. No OAuth redirect, no token to paste anywhere else.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `400 Oauth error app_not_installed` | You skipped step 3 — install the app on your store from the Dev Dashboard |
| `Token exchange fallito (401)` | Wrong Client ID or Secret (copy again, or Renew the secret) |
| `Token exchange fallito (404)` | Wrong `SHOPIFY_DOMAIN`: use `xxx-yyy.myshopify.com`, no `https://`, no custom domain |
| `GraphQL error: Access denied for products field` | The published version lacks `read_products`/`write_products` — edit the version, add the scopes, publish and re-install |
| Empty catalog in the interface | The store has no products with the expected status, or the token belongs to another store |
