import { Redis } from "@upstash/redis";

/**
 * Log persistente delle azioni: chi ha fatto cosa, quando.
 * Usa Upstash Redis (via marketplace Vercel) se configurato; altrimenti
 * tiene un log in-memory (si perde al riavvio) così il dev locale funziona
 * anche prima di collegare lo storage vero.
 */

export interface LogEntry {
  at: number; // epoch ms
  userId: string;
  userLabel: string;
  action: string;
  /** Descrizione leggibile, es. "Nike Air Force 1 — brand: Nike -> Adidas" */
  detail: string;
  productId?: string;
  productTitle?: string;
  /** URL immagine principale del prodotto al momento della modifica. */
  productImage?: string;
  /** Valore prima/dopo per azioni a singolo prodotto (bulk = niente confronto). */
  change?: { before: string; after: string };
  /** Prodotti coinvolti da un'azione di GRUPPO (bulk su più prodotti): titolo + immagine di ciascuno. */
  affectedProducts?: { id: string; title: string; image?: string }[];
}

const LOG_KEY = "catalog:log";
const MAX_ENTRIES = 20_000; // storico permanente, ma con un tetto di sicurezza

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** Fallback in-memory: solo per dev locale senza Redis configurato. */
const memoryLog: LogEntry[] = [];

export async function appendLog(entry: LogEntry): Promise<void> {
  const client = getRedis();
  if (!client) {
    memoryLog.unshift(entry);
    if (memoryLog.length > MAX_ENTRIES) memoryLog.length = MAX_ENTRIES;
    return;
  }
  // lpush + trim: lista ordinata dal più recente, tetto di sicurezza sulla dimensione
  await client.lpush(LOG_KEY, JSON.stringify(entry));
  await client.ltrim(LOG_KEY, 0, MAX_ENTRIES - 1);
}

export async function readLog(limit = 200, offset = 0): Promise<{ entries: LogEntry[]; total: number }> {
  const client = getRedis();
  if (!client) {
    return { entries: memoryLog.slice(offset, offset + limit), total: memoryLog.length };
  }
  const [raw, total] = await Promise.all([
    client.lrange<string>(LOG_KEY, offset, offset + limit - 1),
    client.llen(LOG_KEY),
  ]);
  const entries = raw
    .map((r) => {
      try {
        return (typeof r === "string" ? JSON.parse(r) : r) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is LogEntry => e !== null);
  return { entries, total };
}

export const LOG_STORAGE = () => (getRedis() ? "redis" : "memory");
