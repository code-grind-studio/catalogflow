import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone: necessario per l'immagine Docker (server.js autonomo,
  // senza dover copiare tutto node_modules nel container finale).
  output: "standalone",
};

export default nextConfig;
