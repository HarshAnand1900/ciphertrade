import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@zama-fhe/relayer-sdk"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
