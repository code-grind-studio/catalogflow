import { getRedis } from "./redis";

/**
 * Epoca di sessione per utente: un contatore che vive nello storage condiviso.
 *
 * Il cookie di sessione è `<utente>.<epoca>.<firma>`; verificarlo significa
 * confrontare l'epoca scritta nel cookie con quella corrente. Al logout
 * incrementiamo l'epoca: **tutti** i cookie emessi prima diventano carta
 * straccia, compreso quello che qualcuno avesse copiato altrove. È l'unico modo
 * di revocare una sessione quando il cookie non scade da solo.
 *
 * SENZA storage condiviso la revoca non si fa e l'epoca resta 0. Non è una
 * dimenticanza: il proxy gira in un runtime separato dalle API, quindi un
 * contatore in memoria esisterebbe in due copie destinate a divergere — e
 * dopo un logout l'utente resterebbe chiuso fuori dal proprio catalogo. Meglio
 * nessuna revoca che un blocco.
 *
 * Se lo storage non risponde si lascia passare (fail-open): un guasto di Upstash
 * non deve togliere l'accesso al catalogo. La revoca è una protezione in più,
 * non una condizione per lavorare.
 */
const chiave = (userId: string) => `catalog:session-epoch:${userId}`;

function normalizza(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Epoca corrente per quell'utente (0 = nessuna revoca, o storage assente). */
export async function epocaCorrente(userId: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;
  try {
    return normalizza(await client.get(chiave(userId)));
  } catch {
    return 0;
  }
}

/**
 * Invalida tutte le sessioni aperte di quell'utente. Ritorna la nuova epoca
 * (0 se non c'è storage condiviso: nessuna revoca possibile).
 */
export async function invalidaSessioni(userId: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;
  try {
    return normalizza(await client.incr(chiave(userId)));
  } catch {
    return await epocaCorrente(userId);
  }
}

/**
 * La sessione è ancora valida? Il confronto va sempre fatto contro lo storage:
 * dopo il primo logout anche i cookie con epoca 0 (quelli emessi prima che la
 * revoca esistesse) devono risultare morti.
 */
export async function sessioneAncoraValida(userId: string, epoca: number): Promise<boolean> {
  const client = getRedis();
  if (!client) return true; // senza storage condiviso non c'è epoca da confrontare
  try {
    return epoca === normalizza(await client.get(chiave(userId)));
  } catch {
    return true; // storage giù: non si toglie l'accesso al catalogo per un guasto
  }
}
