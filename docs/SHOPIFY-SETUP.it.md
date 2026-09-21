<div align="center">

# 🔌 Configurazione app Shopify — CatalogFlow

**13 passi, ~15 minuti, nessun codice.** Crei l'app nel Dev Dashboard di Shopify, la installi sul tuo store, copi due valori in `.env.local`.

**[⬅️ Torna a CatalogFlow](../README.md)** · **[⚡ O lascia fare a un agente AI](AI-INSTALL-PROMPT.md)** · **[🩺 Problemi frequenti](#-problemi-frequenti)**

[🇬🇧 English](SHOPIFY-SETUP.md) · 🇮🇹 **Italiano** · [🇫🇷 Français](SHOPIFY-SETUP.fr.md)

</div>

---

> ⚡ **Vuoi saltare i 15 minuti?** Fai fare tutto questo a un agente AI (Claude Code, Cursor,
> Codex…): apri **[AI-INSTALL-PROMPT.md](AI-INSTALL-PROMPT.md)**, copia il prompt e rispondi alle
> sue domande. Quella che segue è la versione **manuale**, passo per passo con gli screenshot.

---

**Cos'è:** CatalogFlow parla con l'Admin API di Shopify usando **Client ID + Secret** di un'app.

Si crea una volta — circa **15 minuti**, niente codice — si installa sul tuo store, si incollano
due valori in `.env.local` e hai finito.

**Screenshot:** presi da un account Shopify reale. L'interfaccia è in francese (la lingua
dell'account) — nella tua lingua le etichette sono le stesse negli stessi punti.

**Cosa è cambiato nel 2026 (importante):** il vecchio flusso *"custom app → copia un token
permanente `shpat_…`"* non esiste più. Ora Shopify crea le app nel **Dev Dashboard**, che
fornisce Client ID e Secret. Il token di accesso se lo chiede CatalogFlow da sola e si rinnova
automaticamente ogni 24 ore — quindi non c'è nessun token da copiare o rigenerare a mano.

---

## 1️⃣ Creare l'app nel Dev Dashboard

**Vai in** Impostazioni → **App e canali di vendita → Sviluppa app**, nell'admin Shopify.

<img src="screenshots/guide/01-shopify-apps-development.png" alt="Impostazioni → Sviluppa app" width="880">

**Clicca** *Sviluppa app nel Dev Dashboard*. Si apre `dev.shopify.com` — sito separato, stesso
login. Vedi l'elenco delle app della tua organizzazione.

<img src="screenshots/guide/02-dev-dashboard-app-list.png" alt="Elenco app Dev Dashboard" width="880">

**Clicca** *Crea un'app*.

<img src="screenshots/guide/03-create-app-page.png" alt="Crea app" width="880">

**Scegli** *Parti dal Dev Dashboard* (non *Parti con Shopify CLI*), scrivi un nome — per esempio
`CatalogFlow` — e conferma.

<img src="screenshots/guide/04-app-name-typed.png" alt="Nome app" width="880">

---

## 2️⃣ Dare i permessi giusti (scope)

Shopify ti chiede subito di creare la **prima versione** dell'app: è qui che vivono i permessi
API.

**Si apre la pagina "Crea una versione":**

<img src="screenshots/guide/05-create-version-scopes.png" alt="Crea versione" width="880">

**Scorri fino a** *Accesso all'API → Scope* e inserisci esattamente:

```
read_products,write_products
```

<img src="screenshots/guide/06-api-scopes.png" alt="Scope" width="880">

> 🔎 `read_products` = leggere il catalogo, `write_products` = modificare titoli, descrizioni,
> prezzi, taglie e varianti, immagini. CatalogFlow non serve altro.

**Clicca** *Pubblica* (in alto a destra o in basso), dai un nome alla versione — per esempio
`1.0.0` — e conferma.

<img src="screenshots/guide/07-publish-version-modal.png" alt="Pubblica versione" width="880">

**La versione è attiva:**

<img src="screenshots/guide/08-version-published.png" alt="Versione pubblicata" width="880">

---

## 3️⃣ Installare l'app sul tuo store (una volta)

**Torna nella Panoramica dell'app e clicca** *Installa l'app* — nella scheda *Installazioni*.

<img src="screenshots/guide/10-app-overview-install.png" alt="Installa app" width="880">

**Shopify chiede su quale store installarla** — scegli il tuo.

<img src="screenshots/guide/11-store-selection.png" alt="Scegli lo store" width="880">

**Controlla i permessi e clicca** *Installa*.

<img src="screenshots/guide/12-install-consent.png" alt="Consenso installazione" width="880">

> ℹ️ Shopify aggiunge sempre un permesso di default sui *dati dei dipendenti e collaboratori* —
> non c'entra niente con CatalogFlow e compare per qualsiasi app.

**Fatto — l'app compare nell'admin del tuo store:**

<img src="screenshots/guide/13-app-installed-in-store.png" alt="Installata" width="880">

> ⚠️ Senza questo passaggio Shopify risponde `400 Oauth error app_not_installed` quando
> CatalogFlow prova a leggere il catalogo.

---

## 4️⃣ Copiare le credenziali in `.env.local`

**Nel Dev Dashboard apri l'app →** *Parametri dell'app* → *Credenziali*: trovi **ID client** e
**Secret**.

<img src="screenshots/guide/09-credentials.png" alt="ID client e Secret" width="880">

- Clicca l'icona di copia accanto a ciascun valore.

- Il Secret si vede per intero una sola volta: se lo perdi clicca *Rigenera* e copia quello nuovo.

**Incollali in `.env.local`** — il file nasce con `cp .env.example .env.local`:

```bash
SHOPIFY_DOMAIN=tuo-store.myshopify.com
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
```

> 📍 **`SHOPIFY_DOMAIN` deve essere il dominio `*.myshopify.com`**, non il tuo dominio
> personalizzato. Lo leggi in Impostazioni → *Domini*, oppure nella barra indirizzi di qualsiasi
> pagina admin: è nella forma `xxx-yyy.myshopify.com`.

**Riavvia CatalogFlow.** Fine — l'app si chiede il suo token da 24 ore e lo rinnova da sola.
Nessun redirect OAuth, nessun token da incollare altrove.

---

## 🩺 Problemi frequenti

| Sintomo | Causa / soluzione |
|---|---|
| `400 Oauth error app_not_installed` | Hai saltato il punto 3 — installa l'app sul tuo store dal Dev Dashboard |
| `Token exchange fallito (401)` | Client ID o Secret sbagliati — ricopiali, o *Rigenera* il secret |
| `Token exchange fallito (404)` | `SHOPIFY_DOMAIN` sbagliato: usa `xxx-yyy.myshopify.com`, senza `https://` e senza dominio personalizzato |
| `GraphQL error: Access denied for products field` | La versione pubblicata non ha `read_products`/`write_products` — modifica la versione, aggiungi gli scope, pubblica e reinstalla |
| Catalogo vuoto nell'interfaccia | Lo store non ha prodotti con lo stato atteso, o il token è di un altro store |
