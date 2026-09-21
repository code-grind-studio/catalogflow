import { NextResponse } from "next/server";
import { activeSession } from "@/lib/api-session";
import { isAdmin, userLabel } from "@/lib/users";

export async function GET() {
  const session = await activeSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    userId: session.userId,
    userLabel: await userLabel(session.userId),
    isAdmin: isAdmin(session.userId),
    // `epoca` = versione di sessione: cambia al logout (vedi lib/session-store)
    epoca: session.epoca,
  });
}
