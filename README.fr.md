# 🛍️ CatalogFlow

[🇬🇧 English](README.md) · [🇮🇹 Italiano](README.it.md) · **🇫🇷 Français**

Une web app **auto-hébergée** pour gérer le **catalogue produits Shopify** sans passer par
l'admin produit par produit : tout le catalogue dans un seul tableau, modification unitaire ou
en masse, gestion des tailles et variantes, nettoyage des images et accès partagé avec un associé.

**Licence MIT.**

---

## 👥 À qui ça s'adresse (et à qui non)

**C'est fait pour les boutiques avec un gros catalogue** — des centaines ou des milliers de
produits — qui doivent **s'organiser vite** au lieu d'ouvrir et d'enregistrer un produit à la fois.

C'est particulièrement utile si :

- 🗂️ vous avez **des centaines ou des milliers de produits** et l'admin Shopify est déjà lent à parcourir

- ✏️ vous devez **appliquer la même modification à beaucoup de produits** (titres, descriptions, prix, tags, statut)

- 📐 vous devez **corriger les tailles** produit par produit (renommer, réordonner, supprimer des variantes)

- 🖼️ vous devez **nettoyer les images** des anciens produits

- 👥 vous êtes **deux** (gérant + associé) et chacun veut son propre accès, sans compte ni e-mail

**Ce n'est pas pour vous si** vous avez une vingtaine de produits : l'admin Shopify suffit.
Ce n'est pas une app publique de l'App Store Shopify et il n'y a aucun abonnement.

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

## ⚡ Installation rapide avec un agent IA (Claude Code, Cursor, Codex…)

Le plus rapide : **ne faites pas les étapes à la main.** Copiez le prompt tout prêt et collez-le
dans votre agent IA, dans un dossier vide — il clone le projet, installe les dépendances, crée
`.env.local`, démarre le serveur et vous guide dans la création de l'app Shopify en ne demandant
que les deux valeurs qu'il ne peut pas obtenir seul.

👉 **[docs/AI-INSTALL-PROMPT.md](docs/AI-INSTALL-PROMPT.md)** — environ 2 minutes d'attention au
lieu de 15 minutes d'étapes manuelles.

---

## 🧰 Prérequis

- **Node.js 20+** — ou Docker, si vous l'utilisez déjà (voir en bas de page)

- Une **boutique Shopify** où créer une app (n'importe quel forfait)

- **15 minutes** pour la configuration Shopify initiale — ou ~2 minutes avec l'agent IA

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

> 💡 **Sur Windows** double-cliquez sur **`Avvia CatalogFlow.bat`** — voir la section Windows ci-dessous.

---

## 🪟 Sur Windows, étape par étape

Aucune expérience nécessaire : cinq étapes, toutes à la souris sauf une.

**1. Installer Node.js 20** (une seule fois)

Ouvrez le **Terminal** Windows (clic droit sur le menu Démarrer → *Terminal* ou *PowerShell*) et collez :

```powershell
winget install OpenJS.NodeJS.LTS
```

Fermez et rouvrez le terminal, puis vérifiez avec `node -v` (il doit répondre `v20` ou plus).

**2. Télécharger le projet**

Sur la page GitHub du repo : bouton vert **Code → Download ZIP**, puis décompressez le dossier où
vous voulez (par exemple dans `Documents`). Ou en ligne de commande :

```powershell
git clone https://github.com/code-grind-studio/catalogflow.git
```

**3. Installer les dépendances**

Ouvrez un **terminal dans le dossier du projet** (ouvrez le dossier dans l'Explorateur, puis clic
droit → *Ouvrir dans le Terminal*) et collez :

```powershell
npm install
```

**4. Créer le fichier de configuration**

Toujours dans le terminal :

```powershell
copy .env.example .env.local
notepad .env.local
```

Remplissez le fichier avec le Bloc-notes (laissez les lignes `SHOPIFY_*` vides jusqu'à la
configuration Shopify) :

- `CATALOG_USER_1_ID` et `CATALOG_USER_1_PASSWORD` → la connexion que vous utiliserez
- `SESSION_SECRET` → une longue chaîne aléatoire ; celle-ci convient :

  ```powershell
  -join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_})
  ```

Enregistrez et fermez le Bloc-notes.

**5. Démarrer**

Double-cliquez sur **`Avvia CatalogFlow.bat`** dans le dossier du projet (ou lancez `npm run dev`
depuis le terminal). Le navigateur s'ouvre sur <http://localhost:3000>.

Pour l'arrêter : fermez la fenêtre noire du terminal. Pour le relancer demain : double-cliquez à
nouveau sur le `.bat`.

> 🪟 Windows protège votre ordinateur : la première fois il peut demander l'autorisation du
> pare-feu (« Autoriser l'accès » sur les réseaux privés) — c'est ce qui permet à la page de
> répondre sur `localhost`.

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

## 🐳 Docker (seulement si vous le connaissez déjà)

> ⚠️ **Si vous n'avez jamais utilisé Docker, sautez cette section** : CatalogFlow n'en a pas
> besoin. Le démarrage normal (`npm run dev`, ou le fichier de lancement) est plus simple et fait
> exactement la même chose sur votre ordinateur.

Docker n'a d'intérêt que si vous voulez le faire tourner sur une machine sans installer Node — un
NAS, un serveur loué, un vieux portable :

```bash
cp .env.example .env.local   # remplissez-le d'abord
docker compose up --build
```

---

## ☁️ Déploiement (optionnel)

`scripts/deploy.sh` déploie sur **Vercel** et pousse les variables de `.env.local` vers le projet
(nécessite `vercel login` une fois).

Tout hébergeur qui exécute Node ou Docker fonctionne pareil : il suffit d'y définir les mêmes
variables d'environnement.

---

## ⚙️ Comment ça marche

- Tous les appels à Shopify se font **côté serveur** : le navigateur ne voit jamais le Client ID,
  le Secret ni le jeton d'accès.

- Le jeton de l'Admin API est demandé via le **client credentials grant**
  (`POST /admin/oauth/access_token`), mis en cache 24 heures et renouvelé automatiquement — rien
  à copier ni à faire tourner à la main.

- Version de l'Admin API : **2025-01**. Le throttling GraphQL est géré avec des retries basés sur
  le coût.

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
| `npm` non reconnu sous Windows | Node.js n'est pas installé, ou le terminal doit être rouvert |

Autres cas : [docs/SHOPIFY-SETUP.fr.md → Dépannage](docs/SHOPIFY-SETUP.fr.md#-dépannage).

---

## 📄 Licence

**MIT** — voir [LICENSE](LICENSE).

Développé par [@code-grind-studio](https://github.com/code-grind-studio).
