import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, userLabel, SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    userId: session.userId,
    userLabel: userLabel(session.userId),
    expiresAt: session.expiresAt,
  });
}
