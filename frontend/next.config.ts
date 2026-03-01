import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    // Resolve 'commonchat-core' to local src so Vercel never looks in node_modules
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "commonchat-core": path.resolve(__dirname, "src/commonchat-core/commonchat_core.js"),
    };
    return config;
  },
};

export default nextConfig;