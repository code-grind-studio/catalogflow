/**
 * Client Shopify Admin lato server.
 *
 * Autenticazione: Client ID + Client Secret di un'app creata nel Dev Dashboard
 * Shopify (https://dev.shopify.com). Il token di accesso Admin API NON si copia
 * a mano: viene richiesto con il "client credentials grant" e messo in cache
 * fino a ~60s prima della scadenza (24h).
 *
 * Serve UNA volta l'installazione dell'app sullo store (Dev Dashboard → Aperçu →
 * "Installer l'appli"): senza installazione Shopify risponde
 * `400 Oauth error app_not_installed`.
 *
 * Vedi docs/SHOPIFY-SETUP.md per i passaggi con gli screenshot.
 * Credenziali e token restano sul server: le route API li usano, il browser no.
 */

const API_VERSION = "2025-01";

interface Creds {
  clientId: string;
  clientSecret: string;
  domain: string;
}

let cachedCreds: Creds | null = null;
let tokenCache: { token: string; expiresAt: number } | null = null;

function loadCreds(): Creds {
  if (cachedCreds) return cachedCreds;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const domain = process.env.SHOPIFY_DOMAIN;
  if (!clientId || !clientSecret || !domain) {
    throw new Error(
      "Credenziali Shopify mancanti: imposta SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_DOMAIN"
    );
  }
  cachedCreds = { clientId, clientSecret, domain };
  return cachedCreds;
}

/** Scambia le credenziali dell'app con un Admin API access token (cache 24h). */
export async function getToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const { clientId, clientSecret, domain } = loadCreds();
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Token exchange fallito (${res.status}): verifica SHOPIFY_CLIENT_ID/SECRET e che l'app sia installata sullo store`
    );
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 86399) * 1000,
  };
  return tokenCache.token;
}

interface ThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

interface GqlEnvelope<T> {
  data?: T;
  errors?: { message?: string; extensions?: { code?: string } }[];
  extensions?: { cost?: { requestedQueryCost?: number; throttleStatus?: ThrottleStatus } };
}

function waitMs(status: ThrottleStatus | undefined, needed: number, attempt: number): number {
  // Shopify ripristina `restoreRate` punti/secondo: aspettiamo esattamente
  // il tempo necessario a riavere il costo della query, con un floor crescente
  // e un tetto per non bloccare la richiesta HTTP più di ~20s.
  const shortfall = Math.max(0, needed - (status?.currentlyAvailable ?? 0));
  const rate = status?.restoreRate && status.restoreRate > 0 ? status.restoreRate : 50;
  const byCost = (shortfall / rate) * 1000 + 250;
  const backoff = 750 * 2 ** attempt;
  return Math.min(Math.max(byCost, backoff), 20_000);
}

export async function shopifyGql<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const { domain } = loadCreds();
  const token = await getToken();

  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
      await new Promise((r) => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 750 * 2 ** attempt));
      continue;
    }

    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 750 * 2 ** attempt));
      continue;
    }

    const json = (await res.json()) as GqlEnvelope<T>;
    const throttle = json.extensions?.cost?.throttleStatus;
    if (json.errors && json.errors.length > 0) {
      const text = JSON.stringify(json.errors);
      const isThrottled = text.includes("Throttled") || text.includes("THROTTLED");
      if (isThrottled) {
        const needed = json.extensions?.cost?.requestedQueryCost ?? 100;
        await new Promise((r) => setTimeout(r, waitMs(throttle, needed, attempt)));
        continue;
      }
      throw new Error(`GraphQL error: ${text.slice(0, 400)}`);
    }
    return json.data as T;
  }
  throw new Error("Shopify: troppi tentativi (throttling)");
}

/** Estrae userErrors da un payload di mutation e lancia se presenti. */
export function assertNoUserErrors(
  payload: Record<string, unknown> | undefined,
  label: string
): void {
  if (!payload) throw new Error(`${label}: risposta vuota`);
  const errors = (payload as { userErrors?: { field?: string[]; message: string }[] }).userErrors;
  if (errors && errors.length > 0) {
    throw new Error(`${label}: ${errors.map((e) => e.message).join("; ")}`);
  }
}

export const CURRENT_API_VERSION = API_VERSION;
