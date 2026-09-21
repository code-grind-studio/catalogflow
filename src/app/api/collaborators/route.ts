import { NextRequest, NextResponse } from "next/server";
import { activeSession } from "@/lib/api-session";
import { addCollaborator, isAdmin, listUsers, removeCollaborator, storage, userLabel } from "@/lib/users";
import { appendLog } from "@/lib/activity-log";

/**
 * Collaboratori del catalogo (nome + password), gestiti dal dialog in alto a
 * destra. Solo l'admin (il primo utente configurato nelle env var) può creare
 * o revocare accessi; chiunque sia in sessione può vedere l'elenco.
 * Le password non escono mai da questa API: si salva e si confronta solo l'hash.
 */

export const runtime = "nodejs";

export async function GET() {
  const session = await activeSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  }

  const users = await listUsers();
  return NextResponse.json({
    ok: true,
    isAdmin: isAdmin(session.userId),
    storage: await storage(),
    collaborators: users.map((u) => ({
      id: u.id,
      label: u.label,
      source: u.source,
      createdAt: u.createdAt,
      createdBy: u.createdBy,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await activeSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  }
  if (!isAdmin(session.userId)) {
    return NextResponse.json(
      { ok: false, error: "Solo l'admin può creare nuovi accessi." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as { label?: string; password?: string } | null;
  try {
    const created = await addCollaborator({
      label: String(body?.label ?? ""),
      password: String(body?.password ?? ""),
      createdBy: await userLabel(session.userId),
    });
    void appendLog({
      at: Date.now(),
      userId: session.userId,
      userLabel: await userLabel(session.userId),
      action: "collaboratorCreate",
      detail: `creato l'accesso per ${created.label}`,
    });
    return NextResponse.json({ ok: true, collaborator: created });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await activeSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sessione scaduta" }, { status: 401 });
  }
  if (!isAdmin(session.userId)) {
    return NextResponse.json(
      { ok: false, error: "Solo l'admin può revocare un accesso." },
      { status: 403 }
    );
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    await removeCollaborator(id);
    void appendLog({
      at: Date.now(),
      userId: session.userId,
      userLabel: await userLabel(session.userId),
      action: "collaboratorDelete",
      detail: `revocato l'accesso di ${id}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
