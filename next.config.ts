import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't bundle the relayer SDK on the server — let it load its own WASM
  // (tfhe_bg.wasm) from node_modules at runtime. Bundling it breaks the WASM path.
  serverExternalPackages: ["@zama-fhe/relayer-sdk"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
