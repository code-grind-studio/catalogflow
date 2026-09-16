import { NextRequest, NextResponse } from "next/server";
import { readLog } from "@/lib/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 500);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const { entries, total } = await readLog(limit, offset);
  return NextResponse.json({ ok: true, entries, total });
}
