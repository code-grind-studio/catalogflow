import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { sessioneAncoraValida } from "@/lib/session-store";

/**
 * Guardia globale (Next 16: `proxy` al posto di `middleware`).
 *
 * Fa due cose:
 *  1. ferma gli attacchi CSRF: una richiesta che CAMBIA qualcosa deve arrivare
 *     dal nostro stesso origin (confronto Origin ↔ Host) e, se porta un corpo,
 *     dichiararlo JSON. Serve perché in produzione il cookie di sessione è
 *     `SameSite=None` (necessario per vivere dentro l'iframe di PersonalOS) e
 *     da solo non impedisce a un sito ostile di far scrivere il browser
 *     dell'utente (creare collaboratori, modificare o cancellare prodotti);
 *  2. pretende una sessione valida su tutto il resto, tranne la pagina di login
 *     e la sua API.
 *
 * Girando su Edge usa solo Web Crypto/`./auth`: mai moduli Node qui.
 */

/** Metodi che cambiano qualcosa: per questi pretendiamo la prova di essere "noi". */
const METODI_DI_SCRITTURA = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** La richiesta arriva dal nostro stesso origin? */
function stessoOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === req.headers.get("host");
    } catch {
      return false;
    }
  }
  // Nessun Origin: è il caso dei client non-browser (curl, script). I browser lo
  // mandano sempre sulle scritture; se manca ma dichiarano di venire da un altro
  // sito (Sec-Fetch-Site), rifiutiamo.
  const sfs = req.headers.get("sec-fetch-site");
  return sfs === null || sfs === "same-origin" || sfs === "none";
}

/** Se la richiesta porta un corpo, deve essere JSON (niente text/plain "semplice"). */
function corpoJson(req: NextRequest): boolean {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(len) || len <= 0) return true; // nessun corpo: DELETE, POST dell'avviso
  return (req.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

/** La richiesta dichiara da dove viene? (Origin oppure Sec-Fetch-Site) */
function provenienzaDichiarata(req: NextRequest): boolean {
  return req.headers.get("origin") !== null || req.headers.get("sec-fetch-site") !== null;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. anti-CSRF su ogni scrittura, login compreso
  if (METODI_DI_SCRITTURA.has(req.method)) {
    // Chi porta la nostra sessione è di fatto un browser: se non dichiara la
    // provenienza (né Origin né Sec-Fetch-Site) rifiutiamo. Le richieste SENZA
    // sessione — il login — restano aperte a qualsiasi client, così gli script
    // di accesso funzionano; se uno script riusa il cookie deve mandare
    // `Origin`, come farebbe un browser.
    const conSessione = req.cookies.has(SESSION_COOKIE);
    if (!stessoOrigin(req) || !corpoJson(req) || (conSessione && !provenienzaDichiarata(req))) {
      return NextResponse.json(
        { ok: false, error: "Richiesta rifiutata: origine o formato non ammessi" },
        { status: 403 }
      );
    }
  }

  // login page e la sua API restano sempre raggiungibili
  if (pathname === "/login" || pathname === "/api/auth") {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  // firma valida non basta: il logout alza l'epoca di sessione dell'utente,
  // quindi i cookie emessi prima — anche quelli copiati altrove — non valgono più
  if (session && (await sessioneAncoraValida(session.userId, session.epoca))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta, effettua di nuovo il login" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  // se c'era un cookie ma è scaduto/non valido, l'utente stava lavorando:
  // avvisiamolo che la sessione è finita (e non solo che deve rifare il login).
  if (token) loginUrl.searchParams.set("expired", "1");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
