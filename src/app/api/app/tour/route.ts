import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { activeSession } from "@/lib/api-session";
import { appCookieOptions, TOUR_NOTICE_COOKIE } from "@/lib/auth";

/**
 * Avviso del tutorial, per l'utente in sessione.
 *
 *   GET  → { ok, showNotice }  l'avviso va mostrato accanto al pulsante "Tutorial"?
 *   POST → { ok }              l'avviso è stato chiuso (o il tutorial aperto)
 *
 * Come funziona (richiesta di Dennis, 21/09/2026): l'avviso compare dopo ogni
 * accesso dalla schermata di login — è `/api/auth` che riscrive il cookie a "1"
 * — e resta finché non lo si chiude; qui la chiusura lo porta a "0". Il tutorial
 * non si apre più da solo.
 *
 * Lo stato sta nel COOKIE, non sul server: in produzione questo progetto non ha
 * Redis, quindi qualunque stato server si perderebbe a ogni riaccensione
 * dell'istanza serverless. Un cookie assente (sessioni aperte prima di questa
 * modifica) vale "mostralo", così l'avviso si vede subito anche senza rientrare.
 */

export const runtime = "nodejs";

export async function GET() {
  const session = await activeSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  }
  const valore = (await cookies()).get(TOUR_NOTICE_COOKIE)?.value;
  return NextResponse.json({ ok: true, showNotice: valore !== "0" });
}

export async function POST() {
  const session = await activeSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOUR_NOTICE_COOKIE, "0", appCookieOptions());
  return res;
}
