/**
 * Sessione a password condivisa per-utente (niente account/email):
 * ogni collaboratore ha la propria password, il sistema sa chi è.
 * Il cookie contiene identità + firma HMAC (Web Crypto, compatibile sia con
 * l'Edge Runtime del proxy sia con le API route Node).
 *
 * La sessione NON scade: si resta dentro finché il cookie c'è. Si esce in due
 * modi: (1) la revoca di un accesso (dialog "Collaboratori") — le API controllano
 * a ogni richiesta che l'utente esista ancora (vedi `userExists` in `./users`);
 * (2) il logout, che incrementa l'epoca di sessione dell'utente (`./session-store`),
 * invalidando ogni cookie emesso prima — anche quello copiato su un'altra macchina.
 * L'epoca vive nello storage condiviso (Upstash): senza, resta in memoria e la
 * revoca non è garantita fra istanze.
 *
 * Chi sono gli utenti (env var + collaboratori creati dalla UI) e la verifica
 * delle password stanno in `./users`: quel modulo usa Redis/fs ed è Node-only,
 * mentre qui resta solo la parte di sessione, che gira anche nel middleware.
 */

import type { UserIdentity } from "./users";

export const SESSION_COOKIE = "catalog_session";

/**
 * Cookie dell'avviso del tutorial: "1" = mostralo, "0" = chiuso.
 * Sta nel browser (non sul server) perché in produzione questo progetto NON ha
 * Redis: un file/stato server non durerebbe, mentre il cookie sopravvive alle
 * riaccensioni dell'istanza, come la sessione.
 */
export const TOUR_NOTICE_COOKIE = "catalogflow_tour";

/** Cookie "per sempre": 10 anni, così il browser non lo butta via. */
export const SESSION_COOKIE_MAX_AGE_S = 10 * 365 * 24 * 60 * 60;

/**
 * Attributi comuni ai cookie dell'app (sessione e avviso del tutorial).
 * SameSite=None richiede Secure: in produzione (https) serve per far funzionare
 * l'app anche dentro un iframe; in sviluppo bastano same-site/Lax.
 */
export function appCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_S,
  };
}

/** Scadenza che significa "nessuna scadenza" (il campo ora è l'epoca di sessione). */
const NO_EXPIRY = 0;

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

/** Crea il valore del cookie: `<userId>.<epoca>.<firma>`. */
export async function createSessionToken(user: UserIdentity, epoca = NO_EXPIRY): Promise<string> {
  const payload = `${user.id}.${epoca}`;
  return `${payload}.${await sign(payload)}`;
}

export interface Session {
  userId: string;
  /**
   * Epoca di sessione al momento dell'emissione (0 = prima revoca mai fatta).
   * Cambia al logout: vedi `sessioneAncoraValida` in `./session-store`.
   */
  epoca: number;
}

export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, epocaStr, sig] = parts;
  const payload = `${userId}.${epocaStr}`;

  const expected = await sign(payload);
  if (!timingSafeEqualHex(sig, expected)) return null;

  const epoca = Number(epocaStr);
  // prima la firma, poi la forma: un valore non numerico qui è un cookie manomesso
  if (!Number.isInteger(epoca) || epoca < 0) return null;

  return { userId, epoca };
}
