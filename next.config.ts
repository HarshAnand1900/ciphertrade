import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@zama-fhe/relayer-sdk"],
  experimental: {
    turbo: {
      resolveExtensions: [".tsx", ".ts", ".jsx", ".js"],
    },
  },
};

export default nextConfig;
