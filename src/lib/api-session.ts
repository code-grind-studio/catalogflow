import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { userExists } from "@/lib/users";

/**
 * Sessione valida E utente ancora esistente.
 *
 * La sessione non scade più, quindi il cookie da solo non basta: se un accesso
 * viene revocato dal dialog "Collaboratori", la sua sessione resterebbe valida
 * per sempre. Qui si verifica a ogni richiesta che l'utente esista ancora, così
 * la revoca ha effetto immediato su tutte le API.
 *
 * Node-only (usa Redis/fs via `./users`): non usarlo nel middleware.
 */
export async function activeSession() {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return (await userExists(session.userId)) ? session : null;
}

/** Risposta standard per sessione non valida o accesso revocato. */
export function unauthorized(message = "Accesso non valido: accedi di nuovo") {
  return Response.json({ ok: false, error: message }, { status: 401 });
}
