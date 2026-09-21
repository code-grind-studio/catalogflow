import type { NextConfig } from "next";

/**
 * Chi può incorniciare il catalogo (iframe dentro PersonalOS). Si allarga senza
 * toccare il codice: variabile d'ambiente FRAME_ANCESTORS, es.
 *   FRAME_ANCESTORS="'self' http://localhost:3200 http://192.168.1.79:3200"
 * Su Vercel va impostata per l'ambiente e richiede un nuovo deploy (il valore
 * finisce nell'header al momento del build).
 */
const FRAME_ANCESTORS =
  process.env.FRAME_ANCESTORS ??
  "'self' http://localhost:3200 http://127.0.0.1:3200 http://192.168.1.79:3200";

const nextConfig: NextConfig = {
  // Output standalone: serve all'immagine Docker (server.js autonomo, senza
  // copiare tutto node_modules nel container finale).
  // Su Vercel NON va usato: Vercel gestisce da sé l'output e con standalone il
  // build si interrompe con "ENOENT: .next/next-server.js.nft.json".
  output: process.env.VERCEL ? undefined : "standalone",

  // Niente icona fluttuante del dev tools in basso a sinistra: in sviluppo
  // copriva l'interfaccia e raccoglieva avvisi che non riguardano il catalogo.
  devIndicators: false,

  // Non regaliamo "X-Powered-By: Next.js" a chi passa di lì.
  poweredByHeader: false,

  /**
   * Header di sicurezza su ogni risposta.
   *
   * Niente X-Frame-Options apposta: non accetta una lista di origini e con
   * DENY/SAMEORIGIN romperebbe l'incorporamento dentro PersonalOS (che è un
   * origin diverso). Il controllo equivalente e più preciso è `frame-ancestors`,
   * che elenca esattamente chi può incorniciare l'app: tutto il resto no
   * (clickjacking).
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${FRAME_ANCESTORS}` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
