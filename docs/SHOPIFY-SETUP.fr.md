# 🔌 Configuration de l'app Shopify — CatalogFlow

[🇬🇧 English](SHOPIFY-SETUP.md) · [🇮🇹 Italiano](SHOPIFY-SETUP.it.md) · **🇫🇷 Français**

---

**En bref :** CatalogFlow communique avec l'API Admin de Shopify via le **Client ID + Secret**
d'une app.

On la crée une fois — environ **15 minutes**, sans coder — on l'installe sur sa boutique, on
colle deux valeurs dans `.env.local`, et c'est terminé.

**Captures d'écran :** prises sur un vrai compte Shopify. L'interface est en français. Dans une
autre langue, les libellés sont identiques au même endroit.

**Ce qui a changé en 2026 (important) :** l'ancien flux *« custom app → copier un jeton permanent
`shpat_…` »* n'existe plus. Shopify crée désormais les apps dans le **Dev Dashboard**, qui
fournit un Client ID et un Secret. Le jeton d'accès est demandé par CatalogFlow elle-même et se
renouvelle automatiquement toutes les 24 heures — aucun jeton à copier ni à faire tourner à la main.

---

## 1️⃣ Créer l'app dans le Dev Dashboard

**Allez dans** Shopify admin → **Paramètres → Applications et canaux de vente → Développer des
applications**.

<img src="screenshots/guide/01-shopify-apps-development.png" alt="Paramètres → Développer des applications" width="880">

**Cliquez sur** *Développer des applications dans le Dev Dashboard*. Cela ouvre `dev.shopify.com`
— site séparé, même identifiant. Vous voyez la liste des apps de votre organisation.

<img src="screenshots/guide/02-dev-dashboard-app-list.png" alt="Liste des apps du Dev Dashboard" width="880">

**Cliquez sur** *Créer une appli*.

<img src="screenshots/guide/03-create-app-page.png" alt="Créer une appli" width="880">

**Choisissez** *Démarrer depuis le Dev Dashboard* (pas *Démarrer avec Shopify CLI*), saisissez un
nom — par exemple `CatalogFlow` — et validez.

<img src="screenshots/guide/04-app-name-typed.png" alt="Nom de l'appli" width="880">

---

## 2️⃣ Donner les bonnes permissions (scopes)

Shopify vous demande aussitôt de créer la **première version** de l'app : c'est là que vivent les
permissions API.

**La page « Créer une version » s'ouvre :**

<img src="screenshots/guide/05-create-version-scopes.png" alt="Créer une version" width="880">

**Descendez jusqu'à** *Accès à l'API → Portées* et saisissez exactement :

```
read_products,write_products
```

<img src="screenshots/guide/06-api-scopes.png" alt="Portées" width="880">

> 🔎 `read_products` = lire le catalogue, `write_products` = modifier titres, descriptions, prix,
> tailles et variantes, images. CatalogFlow n'a besoin de rien d'autre.

**Cliquez sur** *Publier* (en haut à droite ou en bas), nommez la version — par exemple `1.0.0` —
et confirmez.

<img src="screenshots/guide/07-publish-version-modal.png" alt="Publier la version" width="880">

**La version est active :**

<img src="screenshots/guide/08-version-published.png" alt="Version publiée" width="880">

---

## 3️⃣ Installer l'app sur sa boutique (une seule fois)

**Revenez à l'Aperçu de l'app et cliquez sur** *Installer l'appli* — carte *Installations*.

<img src="screenshots/guide/10-app-overview-install.png" alt="Installer l'appli" width="880">

**Shopify demande sur quelle boutique l'installer** — choisissez la vôtre.

<img src="screenshots/guide/11-store-selection.png" alt="Choisir une boutique" width="880">

**Vérifiez les permissions et cliquez sur** *Installer*.

<img src="screenshots/guide/12-install-consent.png" alt="Consentement d'installation" width="880">

> ℹ️ Shopify ajoute toujours une permission par défaut sur les *données des employés et
> collaborateurs* — elle n'a rien à voir avec CatalogFlow et apparaît pour toutes les apps.

**C'est fait — l'app apparaît dans l'admin de votre boutique :**

<img src="screenshots/guide/13-app-installed-in-store.png" alt="Installée" width="880">

> ⚠️ Sans cette étape, Shopify répond `400 Oauth error app_not_installed` lorsque CatalogFlow
> essaie de lire le catalogue.

---

## 4️⃣ Copier les identifiants dans `.env.local`

**Dans le Dev Dashboard, ouvrez l'app →** *Paramètres de l'appli* → *Identifiants* : vous y
trouvez **ID client** et **Secret**.

<img src="screenshots/guide/09-credentials.png" alt="ID client et Secret" width="880">

- Cliquez sur l'icône de copie à côté de chaque valeur.

- Le Secret ne s'affiche en entier qu'une fois : si vous le perdez, cliquez sur *Renouveler* et
  copiez le nouveau.

**Collez-les dans `.env.local`** — le fichier se crée avec `cp .env.example .env.local` :

```bash
SHOPIFY_DOMAIN=votre-boutique.myshopify.com
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
```

> 📍 **`SHOPIFY_DOMAIN` doit être le domaine `*.myshopify.com`**, pas votre domaine personnalisé.
> Vous le trouvez dans Paramètres → *Domaines*, ou dans la barre d'adresse d'une page admin :
> il a la forme `xxx-yyy.myshopify.com`.

**Redémarrez CatalogFlow.** C'est tout — l'app demande son propre jeton de 24 heures et le
renouvelle automatiquement. Pas de redirection OAuth, aucun jeton à coller ailleurs.

---

## 🩺 Dépannage

| Symptôme | Cause / solution |
|---|---|
| `400 Oauth error app_not_installed` | Vous avez sauté l'étape 3 — installez l'app sur votre boutique depuis le Dev Dashboard |
| `Token exchange fallito (401)` | Client ID ou Secret erroné — recopiez-les, ou *Renouvelez* le secret |
| `Token exchange fallito (404)` | `SHOPIFY_DOMAIN` erroné : utilisez `xxx-yyy.myshopify.com`, sans `https://` et sans domaine personnalisé |
| `GraphQL error: Access denied for products field` | La version publiée n'a pas `read_products`/`write_products` — modifiez la version, ajoutez les portées, publiez et réinstallez |
| Catalogue vide dans l'interface | La boutique n'a pas de produits dans l'état attendu, ou le jeton appartient à une autre boutique |
