"use client";

import * as React from "react";
import { Monitor } from "lucide-react";

/**
 * Blocca l'uso da mobile/tablet: l'interfaccia non è ottimizzata per touch/schermi
 * piccoli. Rilevamento su larghezza viewport (soglia tablet-portrait) + user agent,
 * ricontrollato ad ogni resize (rotazione schermo inclusa).
 */
function isMobileLike(): boolean {
  if (typeof window === "undefined") return false;
  const narrow = window.innerWidth < 900;
  const ua = navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(ua);
  return narrow || mobileUa;
}

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const check = () => setBlocked(isMobileLike());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // primo render (SSR/idratazione): non blocca nulla finché non sappiamo la viewport reale,
  // per evitare un flash del contenuto desktop su mobile.
  if (blocked === null) return null;

  if (blocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <Monitor className="size-10 text-muted-foreground" />
        <div className="space-y-1.5">
          <h1 className="text-sm font-semibold">Disponibile solo da computer</h1>
          <p className="max-w-xs text-xs text-muted-foreground">
            Il Catalogo CatalogFlow non è ancora ottimizzato per schermi piccoli o touch.
            Apri questo link da un computer per gestire i prodotti.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
