"use client";

import * as React from "react";

/**
 * Monta i figli solo quando il contenitore si avvicina al viewport.
 *
 * Serve per mostrare TUTTI i prodotti senza pagare il costo di migliaia di
 * card contemporaneamente nel DOM: le sezioni sotto la piega restano un
 * placeholder alto quanto il contenuto stimato (così la barra di scorrimento
 * non "salta"), e si materializzano avvicinandosi. Una volta montate
 * restano montate.
 *
 * `force` bypassa il ritardo: serve quando si deve saltare a un prodotto
 * dentro una sezione non ancora materializzata.
 */
export function LazySection({
  id,
  estimateHeight,
  force = false,
  children,
}: {
  id?: string;
  /** Altezza stimata in px del contenuto non ancora montato. */
  estimateHeight: number;
  force?: boolean;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (force) return;
    const el = ref.current;
    if (!el) return;

    // già in viewport (o quasi): monta subito, senza aspettare l'observer
    if (el.getBoundingClientRect().top < window.innerHeight + 1500) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "1500px 0px" } // inizia a montare 1500px prima di arrivare
    );
    io.observe(el);
    return () => io.disconnect();
  }, [force]);

  return (
    <div ref={ref} id={id}>
      {visible || force ? children : <div style={{ height: estimateHeight }} aria-hidden />}
    </div>
  );
}
