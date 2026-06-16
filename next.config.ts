import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@zama-fhe/relayer-sdk"],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
