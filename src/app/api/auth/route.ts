import { NextRequest, NextResponse } from "next/server";
import { checkPassword } from "@/lib/users";
import {
  appCookieOptions,
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
  TOUR_NOTICE_COOKIE,
} from "@/lib/auth";
import { epocaCorrente, invalidaSessioni } from "@/lib/session-store";
import { azzera, MAX_ERRORI, registraErrore, stato } from "@/lib/login-throttle";
import { appendLog } from "@/lib/activity-log";

/**
 * Login e logout.
 *
 * Il login è l'unica porta d'ingresso e la password si può indovinare, quindi
 * ogni tentativo sbagliato viene contato per indirizzo: dopo `MAX_ERRORI` quello
 * resta in castigo per la finestra prevista (429). Il conteggio vive nello
 * storage condiviso quando c'è, così vale per tutte le istanze dell'app.
 *
 * Il logout non si limita a cancellare il cookie nel browser: alza l'epoca di
 * sessione dell'utente, quindi il cookie che eventualmente fosse stato copiato
 * altrove smette di funzionare.
 */

/** Indirizzo del richiedente, per il conteggio dei tentativi. */
function indirizzo(req: NextRequest): string {
  const inoltro = req.headers.get("x-forwarded-for");
  const primo = inoltro?.split(",")[0]?.trim();
  return primo || req.headers.get("x-real-ip") || "sconosciuto";
}

export async function POST(req: NextRequest) {
  const ip = indirizzo(req);
  const prima = await stato(ip);
  if (prima.bloccato) {
    return NextResponse.json(
      { ok: false, error: `Troppi tentativi: riprova fra ${Math.ceil(prima.attesaS / 60)} minuti.` },
      { status: 429, headers: { "retry-after": String(prima.attesaS) } }
    );
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  const user = await checkPassword(password);
  if (!user) {
    const dopo = await registraErrore(ip);
    void appendLog({
      at: Date.now(),
      userId: "-",
      userLabel: ip,
      action: "accesso-negato",
      detail: dopo.bloccato
        ? `Password sbagliata (${dopo.errori} tentativi): accesso bloccato per ${Math.round(dopo.attesaS / 60)} minuti`
        : `Password sbagliata (${dopo.errori} di ${MAX_ERRORI})`,
    });
    return NextResponse.json(
      {
        ok: false,
        error: dopo.bloccato
          ? `Troppi tentativi: riprova fra ${Math.ceil(dopo.attesaS / 60)} minuti.`
          : "Password errata",
      },
      { status: dopo.bloccato ? 429 : 401 }
    );
  }

  await azzera(ip);
  const epoca = await epocaCorrente(user.id);
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user, epoca), appCookieOptions());
  // avviso del tutorial: riscritto a ogni accesso, così ricompare accanto al
  // pulsante "Tutorial" una volta per accesso (non a ogni ricarica)
  res.cookies.set(TOUR_NOTICE_COOKIE, "1", appCookieOptions());
  return res;
}

export async function DELETE(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    // da qui in poi il cookie è carta straccia ovunque, non solo in questo browser
    await invalidaSessioni(session.userId);
    void appendLog({
      at: Date.now(),
      userId: session.userId,
      userLabel: "—",
      action: "uscita",
      detail: "Sessione chiusa (cookie invalidato anche altrove)",
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
