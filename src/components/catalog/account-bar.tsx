"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, LogOut, ScrollText, User, X } from "lucide-react";
import { LogPanel } from "./log-panel";
import { CollaboratorsDialog } from "./collaborators-dialog";

export function AccountBar() {
  const router = useRouter();
  const [me, setMe] = React.useState<{ userLabel: string } | null>(null);
  const [logOpen, setLogOpen] = React.useState(false);
  const [collabOpen, setCollabOpen] = React.useState(false);
  const [showNotice, setShowNotice] = React.useState(false);

  /**
   * Avviso del tutorial: compare dopo ogni accesso (cookie riscritto dal login,
   * vedi /api/app/tour) e resta finché non lo si chiude. Si chiude anche
   * aprendo il tutorial, da qui o dal pulsante "Tutorial".
   */
  const chiudiAvviso = React.useCallback(() => {
    setShowNotice(false);
    void fetch("/api/app/tour", { method: "POST" }).catch(() => {});
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/app/tour")
      .then((r) => (r.ok ? r.json() : { ok: false }))
      .then((j: { ok: boolean; showNotice?: boolean }) => {
        if (!cancelled && j?.ok && j.showNotice) setShowNotice(true);
      })
      .catch(() => {
        /* rete assente: nessun avviso */
      });
    // il tutorial può essere aperto anche dal suo pulsante: in quel caso
    // l'avviso ha finito il suo compito e si chiude
    window.addEventListener("catalogflow:tour", chiudiAvviso);
    return () => {
      cancelled = true;
      window.removeEventListener("catalogflow:tour", chiudiAvviso);
    };
  }, [chiudiAvviso]);

  /** La sessione non scade da sola: uscire è una scelta esplicita (computer condiviso). */
  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    router.push("/login");
    router.refresh();
  };

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { ok: false }))
      .then((j: { ok: boolean; userLabel?: string }) => {
        if (cancelled) return;
        if (j?.ok && j.userLabel) {
          setMe({ userLabel: j.userLabel });
        } else {
          // sessione non valida o accesso revocato: si torna al login
          // (la sessione non scade più da sola, quindi questo è l'unico caso).
          window.location.href = "/login?expired=1";
        }
      })
      .catch(() => {
        /* rete assente: non buttiamo fuori nessuno */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="ml-auto flex items-center gap-3">
        {me && (
          // click sul nome = gestione collaboratori (nome + password di chi entra)
          <button
            type="button"
            onClick={() => setCollabOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Collaboratori: chi può entrare nel catalogo"
          >
            <User className="size-3.5" />
            {me.userLabel}
          </button>
        )}

        <button
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Vedi chi ha modificato cosa, sessione per sessione"
        >
          <ScrollText className="size-3.5" />
          Log
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("catalogflow:tour"))}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Rivedi il tutorial: cosa fa ogni area e ogni gesto"
        >
          <CircleHelp className="size-3.5" />
          Tutorial
        </button>

        {showNotice && (
          // avviso di accesso: compare a ogni login e resta finché non lo chiudi
          <div
            className="flex items-center gap-2 border border-border bg-muted/20 py-1 pl-2 pr-1"
            title="Avviso mostrato a ogni accesso: il tutorial spiega cosa fa ogni area della pagina"
          >
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("catalogflow:tour"))}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              title="Apri il tutorial guidato: mette in evidenza un'area per volta e spiega a cosa serve"
            >
              <CircleHelp className="size-3.5" />
              Il tutorial spiega ogni area
            </button>
            <button
              type="button"
              onClick={chiudiAvviso}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Chiudi l'avviso del tutorial"
              title="Chiudi l'avviso: torna al prossimo accesso"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {me && (
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Esci: resta connesso finché non esci da qui"
          >
            <LogOut className="size-3.5" />
            Esci
          </button>
        )}
      </div>

      {logOpen && <LogPanel onClose={() => setLogOpen(false)} />}
      {collabOpen && <CollaboratorsDialog onClose={() => setCollabOpen(false)} />}
    </>
  );
}
