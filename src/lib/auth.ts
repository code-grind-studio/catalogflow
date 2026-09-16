/**
 * Sessione a password condivisa per-utente (niente account/email):
 * ogni collaboratore ha la propria password, il sistema sa chi è.
 * Il cookie contiene identità + scadenza, firmati con HMAC (Web Crypto,
 * compatibile sia con l'Edge Runtime del proxy sia con le API route Node).
 * Nessun DB di sessioni: scade sempre dopo SESSION_TTL_MS dal login.
 *
 * Utenti e password configurabili via env var, in terzine:
 *   CATALOG_USER_1_ID / CATALOG_USER_1_LABEL / CATALOG_USER_1_PASSWORD
 *   CATALOG_USER_2_ID / CATALOG_USER_2_LABEL / CATALOG_USER_2_PASSWORD
 *   ... fino a CATALOG_USER_10 (aumenta MAX_USERS qui sotto se ne servono di più)
 * Basta impostare l'utente 1 per avere un solo login (l'admin/proprietario).
 * Per condividere l'accesso con un socio: aggiungi la sua terzina di env var
 * (ID a piacere, LABEL = il nome che vedrà lui, PASSWORD scelta da te) e
 * ridistribuisci la coppia ID/PASSWORD a lui — niente email/account, solo
 * la password gli basta per entrare col suo nome.
 * Si cambiano solo nelle env var (locale: .env.local — produzione: pannello
 * del provider di hosting, es. Vercel → Settings → Environment Variables),
 * niente UI di self-service, niente database.
 */

export const SESSION_COOKIE = "catalog_session";
export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minuti

export interface UserIdentity {
  id: string;
  label: string;
}

const MAX_USERS = 10;

function knownUsers(): Record<string, UserIdentity & { password: string | undefined }> {
  const users: Record<string, UserIdentity & { password: string | undefined }> = {};
  for (let i = 1; i <= MAX_USERS; i++) {
    const id = process.env[`CATALOG_USER_${i}_ID`];
    const password = process.env[`CATALOG_USER_${i}_PASSWORD`];
    if (!id || !password) continue;
    const label = process.env[`CATALOG_USER_${i}_LABEL`] ?? id;
    users[id] = { id, label, password };
  }
  return users;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET mancante");
  return s;
}

async function hmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(secret());
  return crypto.subtle.importKey("raw", enc, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sig);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const pa = a.padEnd(64, "\0");
  const pb = b.padEnd(64, "\0");
  return timingSafeEqualHex(
    [...pa].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join(""),
    [...pb].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join("")
  );
}

/** Verifica la password e restituisce l'identità corrispondente, se valida. */
export function checkPassword(input: string): UserIdentity | null {
  for (const u of Object.values(knownUsers())) {
    if (u.password && timingSafeEqualStr(input, u.password)) {
      return { id: u.id, label: u.label };
    }
  }
  return null;
}

/** Crea il valore del cookie: `<userId>.<scadenzaMs>.<firma>` */
export async function createSessionToken(user: UserIdentity): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${user.id}.${expiresAt}`;
  return `${payload}.${await sign(payload)}`;
}

export interface Session {
  userId: string;
  expiresAt: number;
}

export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, sig] = parts;
  const payload = `${userId}.${expiresAtStr}`;

  const expected = await sign(payload);
  if (!timingSafeEqualHex(sig, expected)) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return null;

  return { userId, expiresAt };
}

export function userLabel(userId: string): string {
  return knownUsers()[userId]?.label ?? userId;
}
