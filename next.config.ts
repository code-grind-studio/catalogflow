import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone: serve all'immagine Docker (server.js autonomo, senza
  // copiare tutto node_modules nel container finale).
  // Su Vercel NON va usato: Vercel gestisce da sé l'output e con standalone il
  // build si interrompe con "ENOENT: .next/next-server.js.nft.json".
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
