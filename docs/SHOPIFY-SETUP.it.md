# Configurazione app Shopify — CatalogFlow

**Cos'è:** CatalogFlow parla con l'Admin API di Shopify usando **Client ID + Secret** di
un'app. Si crea una volta (≈ 15 minuti, niente codice), si installa sul tuo store, si
incollano due valori in `.env.local` e basta.

**Screenshot:** presi da un account Shopify reale. L'interfaccia è in francese
(la lingua del mio account) — nella tua lingua le etichette sono le stesse negli stessi punti.

**Cosa è cambiato nel 2026 (importante):** il vecchio flusso "custom app → copia un token
permanente `shpat_…`" non esiste più. Ora Shopify crea le app nel **Dev Dashboard**, che
fornisce Client ID e Secret; il token di accesso se lo chiede CatalogFlow da solo e si
rinnova automaticamente (24 h). Nessun token da copiare o rigenerare a mano.

---

## 1. Creare l'app nel Dev Dashboard

1. Nell'admin Shopify vai in **Impostazioni → App e canali di vendita → Sviluppa app**.

   ![Impostazioni → Sviluppa app](screenshots/guide/01-shopify-apps-development.png)

2. Clicca **Sviluppa app nel Dev Dashboard**. Si apre `dev.shopify.com` (sito separato,
   stesso login). Vedi l'elenco delle app della tua organizzazione.

   ![Elenco app Dev Dashboard](screenshots/guide/02-dev-dashboard-app-list.png)

3. Clicca **Crea un'app**.

   ![Crea app](screenshots/guide/03-create-app-page.png)

4. Scegli **Parti dal Dev Dashboard** (non "Parti con Shopify CLI"), scrivi un nome —
   es. `CatalogFlow` — e conferma.

   ![Nome app](screenshots/guide/04-app-name-typed.png)

## 2. Dare i permessi giusti (scope)

Shopify ti chiede subito di creare la **prima versione** dell'app: è qui che vivono i
permessi API.

1. Si apre la pagina "Crea una versione":

   ![Crea versione](screenshots/guide/05-create-version-scopes.png)

2. Scorri fino a **Accesso all'API → Scope** e inserisci esattamente:

   ```
   read_products,write_products
   ```

   ![Scope](screenshots/guide/06-api-scopes.png)

   > `read_products` = leggere il catalogo, `write_products` = modificare titoli,
   > descrizioni, prezzi, taglie/varianti, immagini. CatalogFlow non serve altro.

3. Clicca **Pubblica** (in alto a destra o in basso), dai un nome alla versione
   (es. `1.0.0`) e conferma.

   ![Pubblica versione](screenshots/guide/07-publish-version-modal.png)

4. La versione è attiva:

   ![Versione pubblicata](screenshots/guide/08-version-published.png)

## 3. Installare l'app sul tuo store (una volta)

1. Torna nella **Panoramica** dell'app e clicca **Installa l'app** (nella scheda
   *Installazioni*).

   ![Installa app](screenshots/guide/10-app-overview-install.png)

2. Shopify chiede su quale store installarla — scegli il tuo.

   ![Scegli lo store](screenshots/guide/11-store-selection.png)

3. Controlla i permessi e clicca **Installa**.

   ![Consenso installazione](screenshots/guide/12-install-consent.png)

   > Shopify aggiunge sempre un permesso di default sui *dati dei dipendenti/collaboratori*:
   > non c'entra con CatalogFlow e compare per qualsiasi app.

4. Fatto — l'app compare nell'admin del tuo store:

   ![Installata](screenshots/guide/13-app-installed-in-store.png)

   Senza questo passaggio Shopify risponde `400 Oauth error app_not_installed` quando
   CatalogFlow prova a leggere il catalogo.

## 4. Copiare le credenziali in `.env.local`

1. Nel Dev Dashboard apri l'app → **Parametri dell'app** → **Credenziali**: trovi
   **ID client** e **Secret**.

   ![ID client e Secret](screenshots/guide/09-credentials.png)

   - Clicca l'icona di copia accanto a ciascun valore.
   - Il Secret si vede per intero una sola volta: se lo perdi clicca **Rigenera** e copia
     quello nuovo.

2. Incollali in `.env.local` (il file nasce con `cp .env.example .env.local`):

   ```bash
   SHOPIFY_DOMAIN=tuo-store.myshopify.com
   SHOPIFY_CLIENT_ID=...
   SHOPIFY_CLIENT_SECRET=...
   ```

   > **`SHOPIFY_DOMAIN` deve essere il dominio `*.myshopify.com`**, non il tuo dominio
   > personalizzato. Lo leggi in Impostazioni → Domini (o nella barra indirizzi di
   > qualsiasi pagina admin: è nella forma `xxx-yyy.myshopify.com`).

3. Riavvia CatalogFlow. Fine: l'app si chiede il suo token da 24 h e lo rinnova da sola.
   Nessun redirect OAuth, nessun token da incollare altrove.

---

## Problemi frequenti

| Sintomo | Causa / soluzione |
|---|---|
| `400 Oauth error app_not_installed` | Hai saltato il punto 3 — installa l'app sul tuo store dal Dev Dashboard |
| `Token exchange fallito (401)` | Client ID o Secret sbagliati (ricopiali, o Rigenera il secret) |
| `Token exchange fallito (404)` | `SHOPIFY_DOMAIN` sbagliato: usa `xxx-yyy.myshopify.com`, senza `https://` e senza dominio personalizzato |
| `GraphQL error: Access denied for products field` | La versione pubblicata non ha `read_products`/`write_products`: modifica la versione, aggiungi gli scope, pubblica e reinstalla |
| Catalogo vuoto nell'interfaccia | Lo store non ha prodotti con lo stato atteso, o il token è di un altro store |
