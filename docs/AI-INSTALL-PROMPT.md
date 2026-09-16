# ⚡ Fast install with an AI coding agent (Claude Code, Cursor, Codex…)

**What this is:** a ready-to-paste prompt that makes an AI coding agent do the whole
CatalogFlow installation for you — clone, dependencies, `.env.local`, first start — and walk
you through the Shopify app creation step by step, asking you only for the two values it
cannot get by itself (Client ID and Secret).

**Time:** about 2 minutes of your attention instead of 15 minutes of manual work.

**How to use it:**

1. Open your AI coding agent (Claude Code, Cursor, Codex, Gemini CLI…) inside an empty folder.
2. Paste the whole prompt below.
3. Answer its questions; when it asks for the Shopify app, follow the screenshots in
   [`SHOPIFY-SETUP.md`](SHOPIFY-SETUP.md) — it will tell you exactly when.
4. At the end, open <http://localhost:3000> and log in.

> 💬 The agent replies in your language: the prompt is in English only because it is
> instructions for the model, not text you have to read.

---

## 📋 The prompt — copy from here

```
You are setting up CatalogFlow (a self-hosted Shopify catalog manager) on this computer.
Work autonomously, do the boring parts yourself, and ask me only what you cannot do on my behalf.

Rules:
- Explain each step in one short line before doing it, in my language.
- Never invent values: if you need something from me, ask.
- Never print secrets (Client ID, Secret, passwords) in the chat.
- Verify each step really worked before moving on; if something fails, say it plainly
  and try the alternative (do not pretend it worked).

Steps to perform:

1. CHECK THE ENVIRONMENT
   - Detect the operating system and whether Node.js 20+ and git are installed
     (node -v, npm -v, git --version).
   - If Node is missing or older than 20, tell me the exact command for my OS
     (macOS: brew install node ; Windows: winget install OpenJS.NodeJS.LTS)
     and stop until I confirm.

2. GET THE CODE
   - Clone https://github.com/code-grind-studio/catalogflow.git into a folder named
     catalogflow (or use the current folder if it is already the repo).
   - Run: npm install

3. CREATE .env.local
   - Copy .env.example to .env.local.
   - Generate SESSION_SECRET with: openssl rand -hex 32
     (on Windows PowerShell: -join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_}))
   - Ask me for the login ID and password I want for the first user
     (default suggestion: admin + a password I choose) and write CATALOG_USER_1_ID,
     CATALOG_USER_1_PASSWORD, CATALOG_USER_1_LABEL.
   - Leave SHOPIFY_* empty for now: we fill them in step 5.

4. EXPLAIN WHAT THE SHOPIFY APP IS
   - In 3 lines: CatalogFlow talks to the Shopify Admin API through an app created in the
     Shopify Dev Dashboard; it needs a Client ID and a Client Secret. The access token is
     requested automatically by the app, there is no token to copy.

5. SHOPIFY APP (I do this part in my browser, you guide me)
   - Tell me to open https://github.com/code-grind-studio/catalogflow/blob/main/docs/SHOPIFY-SETUP.md
     (or the .it.md / .fr.md version if I speak Italian/French) and to follow it.
   - Wait for me to paste the Client ID and the Secret.
   - Write them into .env.local (SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET) without echoing
     them in the chat, and ask me for my store domain in the form xxx-yyy.myshopify.com
     (SHOPIFY_DOMAIN). Explain that it is NOT the custom domain.

6. FIRST START AND TEST
   - Start the app in the background (npm run dev) and wait until it says Ready.
   - Verify that http://localhost:3000/login answers.
   - Tell me the address and the credentials to use.
   - If the catalog is empty or Shopify answers 400 app_not_installed, tell me exactly
     which part of docs/SHOPIFY-SETUP.md to re-check (install step / scopes).

7. LEAVE IT READY
   - Explain how to start it again tomorrow (npm run dev, or double-click
     "Avvia CatalogFlow.command" on macOS / "Avvia CatalogFlow.bat" on Windows).
   - Remind me that .env.local contains secrets and must never be committed.

Start with step 1.
```

---

## 🧩 Without an AI agent

Everything the prompt does is written out step by step in:

- 🇬🇧 [Shopify app setup — English](SHOPIFY-SETUP.md)
- 🇮🇹 [Configurazione app Shopify — Italiano](SHOPIFY-SETUP.it.md)
- 🇫🇷 [Configuration de l'app Shopify — Français](SHOPIFY-SETUP.fr.md)

and in the [README](../README.md) (Quick start / Windows / Docker sections).
