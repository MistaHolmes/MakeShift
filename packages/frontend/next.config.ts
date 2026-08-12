import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf.js-extract", "pdfjs-dist", "canvas", "dommatrix"],
  images: {
    qualities: [75, 90],
  },
};

export default nextConfig;
