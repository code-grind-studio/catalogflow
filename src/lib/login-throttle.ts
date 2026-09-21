import { getRedis } from "./redis";

/**
 * Freno ai tentativi di password. Il login è l'unica porta d'ingresso e la
 * password si può indovinare: dopo `MAX_ERRORI` sbagli da uno stesso indirizzo,
 * quello resta in castigo per la finestra indicata e riceve 429.
 *
 * Con Redis il conteggio vale per tutte le istanze dell'app; senza, resta in
 * memoria (dev locale): su Vercel ogni istanza conterebbe per conto suo.
 */
export const MAX_ERRORI = 10;
export const FINESTRA_S = 15 * 60;

const chiave = (ip: string) => `catalog:login-fail:${ip}`;
const memoria = new Map<string, { errori: number; fino: number }>();

export interface StatoTentativi {
  bloccato: boolean;
  errori: number;
  /** Secondi che mancano alla fine del castigo (0 se non è in castigo). */
  attesaS: number;
}

function statoDaMemoria(ip: string): StatoTentativi {
  const v = memoria.get(ip);
  if (!v || v.fino <= Date.now()) {
    memoria.delete(ip);
    return { bloccato: false, errori: 0, attesaS: 0 };
  }
  return { bloccato: v.errori >= MAX_ERRORI, errori: v.errori, attesaS: Math.ceil((v.fino - Date.now()) / 1000) };
}

/** Quanti errori ha accumulato questo indirizzo e se è in castigo. */
export async function stato(ip: string): Promise<StatoTentativi> {
  const client = getRedis();
  if (!client) return statoDaMemoria(ip);
  try {
    const [grezzo, ttl] = await Promise.all([client.get(chiave(ip)), client.ttl(chiave(ip))]);
    const errori = Number(grezzo ?? 0) || 0;
    return {
      bloccato: errori >= MAX_ERRORI,
      errori,
      attesaS: typeof ttl === "number" && ttl > 0 ? ttl : 0,
    };
  } catch {
    // storage giù: si lascia provare (un guasto non deve chiudere fuori nessuno)
    return { bloccato: false, errori: 0, attesaS: 0 };
  }
}

/** Segna un tentativo sbagliato e ritorna lo stato aggiornato. */
export async function registraErrore(ip: string): Promise<StatoTentativi> {
  const client = getRedis();
  if (!client) {
    const ora = Date.now();
    const v = memoria.get(ip);
    const errori = (!v || v.fino <= ora ? 0 : v.errori) + 1;
    memoria.set(ip, { errori, fino: ora + FINESTRA_S * 1000 });
    return statoDaMemoria(ip);
  }
  try {
    const errori = Number(await client.incr(chiave(ip))) || 1;
    // la finestra scorre dall'ultimo tentativo: un attacco lento non si salva
    await client.expire(chiave(ip), FINESTRA_S);
    return { bloccato: errori >= MAX_ERRORI, errori, attesaS: FINESTRA_S };
  } catch {
    return { bloccato: false, errori: 0, attesaS: 0 };
  }
}

/** Accesso riuscito: si riparte da zero. */
export async function azzera(ip: string): Promise<void> {
  const client = getRedis();
  if (!client) {
    memoria.delete(ip);
    return;
  }
  try {
    await client.del(chiave(ip));
  } catch {
    // pazienza: il conteggio scade da solo
  }
}
