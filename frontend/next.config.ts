import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    const commonchatCorePath = path.resolve(process.cwd(), "src/commonchat-core/commonchat_core.js");
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      "commonchat-core": commonchatCorePath,
      ...(config.resolve.alias || {}),
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "commonchat-core": commonchatCorePath,
    };
    return config;
  },
};

export default nextConfig;