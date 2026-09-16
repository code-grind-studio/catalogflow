# 🛍️ CatalogFlow

[🇬🇧 English](README.md) · [🇮🇹 Italiano](README.it.md) · **🇫🇷 Français**

Une web app **auto-hébergée** pour gérer le **catalogue produits Shopify** sans passer par
l'admin produit par produit : tout le catalogue dans un seul tableau, modification unitaire
ou en masse, gestion des tailles et variantes, nettoyage des images et accès partagé avec un
associé.

Conçue pour les boutiques tenues par une ou deux personnes — pas de SaaS multi-tenant, pas de
base de données, pas de publication sur l'App Store Shopify. Elle tourne sur votre machine ou
votre serveur.

**Licence MIT.**

---

## ✨ Ce qu'elle fait

- **Tout le catalogue dans un tableau** — recherche, filtres, prix, statut, images et tailles d'un coup d'œil.

- **Éditeur produit unitaire** — titre, description, prix, tags, type de produit, statut.

- **Modifications en masse** — la même modification sur une sélection de produits, avec barre de progression.

- **Tailles et variantes** — créer, renommer, réordonner et supprimer options et variantes, par produit.

- **Images** — réordonner et supprimer les médias des produits.

- **Metafields** — lit et écrit `custom.fornitore_url`, `custom.modello`, `custom.gruppo`.

- **Multi-utilisateur par mot de passe** — jusqu'à 10 comptes définis dans les variables d'environnement, sans e-mail ni base de données.

- **Journal d'activité** — qui a modifié quoi et quand (persistance Redis en option).

---

## 🧰 Prérequis

- **Node.js 20+** — ou Docker, si vous préférez (voir plus bas)

- Une **boutique Shopify** où créer une app (n'importe quel forfait)

- **15 minutes** pour la configuration Shopify initiale

---

## 🚀 Démarrage rapide

```bash
git clone https://github.com/code-grind-studio/catalogflow.git
cd catalogflow
npm install
cp .env.example .env.local     # puis remplir les valeurs (voir ci-dessous)
npm run dev
```

Ouvrez <http://localhost:3000> et connectez-vous avec `CATALOG_USER_1_ID` et
`CATALOG_USER_1_PASSWORD` définis dans `.env.local`.

> 💡 **Sur macOS** vous pouvez aussi double-cliquer sur **`Avvia CatalogFlow.command`** : au
> premier lancement il installe les dépendances, démarre le serveur et ouvre le navigateur.

---

## 🔌 Créer l'app Shopify (une fois)

CatalogFlow s'authentifie avec un **Client ID + Secret**. L'app se crée dans le
**Dev Dashboard** de Shopify, s'installe sur votre boutique, et les deux valeurs se collent
dans `.env.local`.

Guide complet avec captures d'écran — 13 étapes, environ 15 minutes :

- 🇫🇷 [**Configuration de l'app Shopify — Français**](docs/SHOPIFY-SETUP.fr.md)

- 🇬🇧 [Shopify app setup — English](docs/SHOPIFY-SETUP.md)

- 🇮🇹 [Configurazione app Shopify — Italiano](docs/SHOPIFY-SETUP.it.md)

Version courte : créez l'app → publiez une version avec les portées
`read_products,write_products` → **Installer l'appli** sur votre boutique → copiez
**ID client** et **Secret** dans `.env.local`.

> ⚠️ L'installation n'est pas facultative : sans elle Shopify répond
> `400 Oauth error app_not_installed`.

---

## 🔐 Variables d'environnement

| Nom | Obligatoire | Description |
|---|---|---|
| `SHOPIFY_DOMAIN` | ✅ oui | votre domaine `xxx-yyy.myshopify.com` — pas le domaine personnalisé |
| `SHOPIFY_CLIENT_ID` | ✅ oui | Client ID de l'app (Dev Dashboard → Paramètres de l'appli → Identifiants) |
| `SHOPIFY_CLIENT_SECRET` | ✅ oui | Secret de l'app (même page — affiché en entier une seule fois) |
| `CATALOG_USER_1_ID` | ✅ oui | identifiant de connexion du premier utilisateur |
| `CATALOG_USER_1_PASSWORD` | ✅ oui | mot de passe du premier utilisateur |
| `CATALOG_USER_1_LABEL` | ➖ non | nom affiché dans l'interface (par défaut : l'ID) |
| `CATALOG_USER_2_ID` … `_10_` | ➖ non | autres utilisateurs, mêmes trois variables (`_ID`, `_PASSWORD`, `_LABEL`) |
| `SESSION_SECRET` | ✅ oui | chaîne aléatoire signant le cookie de session (`openssl rand -hex 32`) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ➖ non | identifiants REST Upstash Redis : conservent journal d'activité et progression d'import entre deux redémarrages |

⏱️ La session dure **30 minutes**, puis le mot de passe est redemandé.

---

## 🐳 Lancer avec Docker

```bash
cp .env.example .env.local   # remplissez-le d'abord
docker compose up --build
```

Ouvrez <http://localhost:3000>.

L'image construit un serveur Next.js standalone : aucune installation de Node sur l'hôte, et
elle tourne sur toute machine avec Docker — NAS, VPS, vieux portable.

---

## ☁️ Déploiement (optionnel)

`scripts/deploy.sh` déploie sur **Vercel** et pousse les variables de `.env.local` vers le
projet (nécessite `vercel login` une fois).

Tout hébergeur qui exécute Node ou Docker fonctionne pareil : il suffit d'y définir les mêmes
variables d'environnement.

---

## ⚙️ Comment ça marche

- Tous les appels à Shopify se font **côté serveur** : le navigateur ne voit jamais le Client
  ID, le Secret ni le jeton d'accès.

- Le jeton de l'Admin API est demandé via le **client credentials grant**
  (`POST /admin/oauth/access_token`), mis en cache 24 heures et renouvelé automatiquement —
  rien à copier ni à faire tourner à la main.

- Version de l'Admin API : **2025-01**. Le throttling GraphQL est géré avec des retries basés
  sur le coût.

- La connexion est un cookie HMAC signé (Web Crypto) — pas de base de sessions.

---

## 🗂️ Structure du projet

```
src/app/            pages (catalogue, connexion) + routes API
src/lib/catalog/    client Shopify, normalisation du catalogue, tailles, taxonomie
src/components/     tableau catalogue, dialogues produit, tray de sélection
docs/               guides de configuration (EN/IT/FR) + captures d'écran
scripts/            helper de déploiement Vercel
```

---

## 🩺 Dépannage

| Symptôme | Solution |
|---|---|
| `400 Oauth error app_not_installed` | installez l'app sur votre boutique — étape 3 du guide |
| `Token exchange fallito (404)` | `SHOPIFY_DOMAIN` doit être `xxx-yyy.myshopify.com` |
| La page de connexion se recharge sans entrer | `SESSION_SECRET` manquant, ou couple ID/mot de passe qui ne correspond pas |
| Catalogue vide | mauvaise boutique, ou version publiée sans `read_products` |

Autres cas : [docs/SHOPIFY-SETUP.fr.md → Dépannage](docs/SHOPIFY-SETUP.fr.md#dépannage).

---

## 📄 Licence

**MIT** — voir [LICENSE](LICENSE).

Développé par [@code-grind-studio](https://github.com/code-grind-studio).
