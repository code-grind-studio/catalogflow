# 🛍️ CatalogFlow

[🇬🇧 English](README.md) · **🇮🇹 Italiano** · [🇫🇷 Français](README.fr.md)

Web app **self-hosted** per gestire il **catalogo prodotti di Shopify** senza passare
dall'admin prodotto per prodotto: tutto il catalogo in un'unica tabella, modifica singola o
in blocco, sistemazione di taglie e varianti, pulizia immagini e accesso condiviso con un socio.

Nata per negozi gestiti da una o due persone — niente SaaS multi-tenant, niente database,
niente pubblicazione sull'App Store di Shopify. Gira sul tuo computer o sul tuo server.

**Licenza MIT.**

---

## ✨ Cosa fa

- **Tutto il catalogo in una tabella** — ricerca, filtri, prezzo, stato, immagini e taglie a colpo d'occhio.

- **Editor prodotto singolo** — titolo, descrizione, prezzo, tag, tipo prodotto, stato.

- **Modifiche in blocco** — la stessa modifica su una selezione di prodotti, con barra di avanzamento.

- **Taglie e varianti** — crea, rinomina, riordina ed elimina opzioni e varianti, per prodotto.

- **Immagini** — riordina ed elimina le immagini dei prodotti.

- **Metafield** — legge e scrive `custom.fornitore_url`, `custom.modello`, `custom.gruppo`.

- **Multi-utente a password** — fino a 10 account definiti via env var, senza email né database.

- **Log attività** — chi ha modificato cosa e quando (persistenza su Redis opzionale).

---

## 🧰 Requisiti

- **Node.js 20+** — oppure Docker, se preferisci (vedi sotto)

- Uno **store Shopify** dove poter creare un'app (qualsiasi piano)

- **15 minuti** per la configurazione Shopify iniziale

---

## 🚀 Avvio rapido

```bash
git clone https://github.com/code-grind-studio/catalogflow.git
cd catalogflow
npm install
cp .env.example .env.local     # poi riempi i valori (vedi sotto)
npm run dev
```

Apri <http://localhost:3000> e accedi con `CATALOG_USER_1_ID` e `CATALOG_USER_1_PASSWORD`
impostati in `.env.local`.

> 💡 **Su macOS** puoi anche fare doppio click su **`Avvia CatalogFlow.command`**: al primo
> avvio installa le dipendenze, avvia il server e apre il browser.

---

## 🔌 Creare l'app Shopify (una volta)

CatalogFlow si autentica con **Client ID + Secret**. L'app si crea nel **Dev Dashboard** di
Shopify, si installa sul tuo store e i due valori si incollano in `.env.local`.

Guida completa con screenshot — 13 passaggi, circa 15 minuti:

- 🇮🇹 [**Configurazione app Shopify — Italiano**](docs/SHOPIFY-SETUP.it.md)

- 🇬🇧 [Shopify app setup — English](docs/SHOPIFY-SETUP.md)

- 🇫🇷 [Configuration de l'app Shopify — Français](docs/SHOPIFY-SETUP.fr.md)

Versione breve: crea l'app → pubblica una versione con gli scope
`read_products,write_products` → **Installa l'app** sul tuo store → copia **ID client** e
**Secret** in `.env.local`.

> ⚠️ L'installazione non è facoltativa: senza di essa Shopify risponde
> `400 Oauth error app_not_installed`.

---

## 🔐 Variabili d'ambiente

| Nome | Obbligatoria | Cos'è |
|---|---|---|
| `SHOPIFY_DOMAIN` | ✅ sì | il tuo dominio `xxx-yyy.myshopify.com` — non il dominio personalizzato |
| `SHOPIFY_CLIENT_ID` | ✅ sì | ID client dell'app (Dev Dashboard → Parametri dell'app → Credenziali) |
| `SHOPIFY_CLIENT_SECRET` | ✅ sì | Secret dell'app (stessa pagina — si vede per intero una sola volta) |
| `CATALOG_USER_1_ID` | ✅ sì | identificativo di login del primo utente |
| `CATALOG_USER_1_PASSWORD` | ✅ sì | password del primo utente |
| `CATALOG_USER_1_LABEL` | ➖ no | nome mostrato nell'interfaccia (default: l'ID) |
| `CATALOG_USER_2_ID` … `_10_` | ➖ no | altri utenti, stesse tre variabili (`_ID`, `_PASSWORD`, `_LABEL`) |
| `SESSION_SECRET` | ✅ sì | stringa casuale che firma il cookie di sessione (`openssl rand -hex 32`) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ➖ no | credenziali REST Upstash Redis: mantengono log attività e stato import tra un riavvio e l'altro |

⏱️ La sessione dura **30 minuti**, poi richiede di nuovo la password.

---

## 🐳 Avvio con Docker

```bash
cp .env.example .env.local   # riempilo prima
docker compose up --build
```

Apri <http://localhost:3000>.

L'immagine costruisce un server Next.js standalone: non serve Node sull'host e gira su
qualsiasi macchina con Docker — NAS, VPS, un portatile vecchio.

---

## ☁️ Deploy (opzionale)

`scripts/deploy.sh` deploya su **Vercel** e carica le variabili da `.env.local` sul progetto
(richiede `vercel login` una volta).

Qualsiasi host che esegua Node o Docker va bene allo stesso modo: basta impostare le stesse
variabili d'ambiente.

---

## ⚙️ Come funziona

- Tutte le chiamate a Shopify avvengono **lato server**: il browser non vede mai Client ID,
  Secret né token di accesso.

- Il token dell'Admin API viene richiesto con il **client credentials grant**
  (`POST /admin/oauth/access_token`), messo in cache 24 ore e rinnovato da solo — non c'è
  niente da copiare o rigenerare a mano.

- Versione Admin API: **2025-01**. Il throttling GraphQL è gestito con retry basati sul costo.

- Il login è un cookie HMAC firmato (Web Crypto) — nessun database di sessioni.

---

## 🗂️ Struttura del progetto

```
src/app/            pagine (catalogo, login) + route API
src/lib/catalog/    client Shopify, normalizzazione catalogo, taglie, tassonomia
src/components/     tabella catalogo, dialoghi prodotto, tray di selezione
docs/               guide di configurazione (EN/IT/FR) + screenshot
scripts/            helper deploy Vercel
```

---

## 🩺 Problemi frequenti

| Sintomo | Soluzione |
|---|---|
| `400 Oauth error app_not_installed` | installa l'app sul tuo store — punto 3 della guida |
| `Token exchange fallito (404)` | `SHOPIFY_DOMAIN` deve essere `xxx-yyy.myshopify.com` |
| La pagina di login si ricarica senza entrare | `SESSION_SECRET` mancante, o coppia ID/password che non combacia |
| Catalogo vuoto | store sbagliato, o versione pubblicata senza `read_products` |

Altri casi: [docs/SHOPIFY-SETUP.it.md → Problemi frequenti](docs/SHOPIFY-SETUP.it.md#problemi-frequenti).

---

## 📄 Licenza

**MIT** — vedi [LICENSE](LICENSE).

Sviluppato da [@code-grind-studio](https://github.com/code-grind-studio).
