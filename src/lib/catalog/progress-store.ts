import { Redis } from "@upstash/redis";

/**
 * Stato del caricamento del catalogo, condiviso tra le istanze serverless.
 *
 * Su Vercel ogni invocazione di funzione può finire su un'istanza diversa:
 * `loadProgress` in-memory (src/lib/catalog/catalog.ts) resta valido SOLO
 * per l'istanza che sta effettivamente caricando. Se il polling di
 * /api/catalog/products/progress finisce su un'ALTRA istanza (fredda, che
 * non ha mai eseguito il caricamento), quella risponde sempre con
 * loaded=0/estimatedTotal=0 — la barra sembra "non muoversi mai".
 *
 * Fix: scriviamo lo stato anche su Upstash Redis (già usato per il log
 * attività), con un TTL breve visto che è un dato transitorio; l'endpoint di
 * progress legge PRIMA da Redis (stato vero, condiviso), e solo se non c'è
 * (Redis non configurato, es. dev locale) usa la memoria locale.
 */

const KEY = "catalog:progress";
const TTL_SECONDS = 120; // dato effimero: se scade, il caricamento è comunque finito o fallito

export interface ProgressState {
  active: boolean;
  loaded: number;
  estimatedTotal: number;
}

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

/** Scrittura best-effort: non deve MAI bloccare o far fallire il caricamento vero. */
export function writeProgress(state: ProgressState): void {
  const client = getRedis();
  if (!client) return;
  void client.set(KEY, JSON.stringify(state), { ex: TTL_SECONDS }).catch(() => {
    /* non critico: la UI userà il fallback in-memory locale */
  });
}

/** Lettura: null se Redis non è configurato o il valore non è (ancora) presente. */
export async function readProgress(): Promise<ProgressState | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const raw = await client.get<string>(KEY);
    if (!raw) return null;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as ProgressState;
  } catch {
    return null;
  }
}
