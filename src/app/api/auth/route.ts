import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  const user = checkPassword(password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Password errata" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    // SameSite=None richiede Secure: su http (dev locale) va rifiutato dal browser
    // se combinato così. In sviluppo usiamo Lax (basta, stesso sito), in produzione
    // (sempre https) None+Secure per compatibilità con eventuali iframe/proxy.
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
