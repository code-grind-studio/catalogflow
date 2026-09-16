"use client";

import * as React from "react";
import { ScrollText, User } from "lucide-react";
import { LogPanel } from "./log-panel";

export function AccountBar() {
  const [me, setMe] = React.useState<{ userLabel: string; expiresAt: number } | null>(null);
  const [logOpen, setLogOpen] = React.useState(false);
  const [minsLeft, setMinsLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.ok && setMe(j));
  }, []);

  React.useEffect(() => {
    if (!me) return;
    const tick = () => {
      const msLeft = me.expiresAt - Date.now();
      setMinsLeft(Math.max(0, Math.round(msLeft / 60000)));
      // scaduta: nessun popup di conferma, si passa direttamente al login
      // con un avviso mostrato LÌ (query param ?expired=1).
      if (msLeft <= 0) {
        void fetch("/api/auth", { method: "DELETE" }).finally(() => {
          window.location.href = "/login?expired=1";
        });
      }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [me]);

  return (
    <>
      <div className="ml-auto flex items-center gap-3">
        {me && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3.5" />
            {me.userLabel}
            {minsLeft !== null && (
              <span className={minsLeft <= 5 ? "text-destructive" : ""}>· {minsLeft} min</span>
            )}
          </span>
        )}

        <button
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          title="Vedi chi ha modificato cosa, sessione per sessione"
        >
          <ScrollText className="size-3.5" />
          Log
        </button>
      </div>

      {logOpen && <LogPanel onClose={() => setLogOpen(false)} />}
    </>
  );
}
