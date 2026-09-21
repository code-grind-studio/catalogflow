import { NextRequest, NextResponse } from "next/server";
import { checkPassword } from "@/lib/users";
import {
  appCookieOptions,
  createSessionToken,
  SESSION_COOKIE,
  TOUR_NOTICE_COOKIE,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  const user = await checkPassword(password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Password errata" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user), appCookieOptions());
  // avviso del tutorial: riscritto a ogni accesso, così ricompare accanto al
  // pulsante "Tutorial" una volta per accesso (non a ogni ricarica)
  res.cookies.set(TOUR_NOTICE_COOKIE, "1", appCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
