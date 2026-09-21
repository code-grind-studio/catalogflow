import { Redis } from "@upstash/redis";

/**
 * Client Upstash Redis condiviso dai moduli che hanno bisogno di uno stato che
 * sopravvive al riavvio (log attività, collaboratori, barra di import, freno ai
 * tentativi di password, epoca di sessione).
 *
 * Accetta sia i nomi del marketplace Vercel (`KV_REST_API_*`) sia quelli diretti
 * Upstash (`UPSTASH_REDIS_REST_*`). Se non è configurato restituisce `null`: in
 * quel caso chi lo usa ripiega su uno stato in memoria, che va bene per lo
 * sviluppo locale ma si perde al riavvio e su Vercel non è condiviso fra istanze.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/** C'è uno storage condiviso configurato? */
export function storageCondiviso(): boolean {
  return getRedis() !== null;
}
