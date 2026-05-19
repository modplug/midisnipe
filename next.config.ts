import type { NextConfig } from "next";

const isElectronBuild = process.env.NEXT_PUBLIC_ELECTRON === "1";

const nextConfig: NextConfig = {
  output: isElectronBuild ? "export" : undefined,
  assetPrefix: isElectronBuild ? "./" : undefined,
  images: {
    unoptimized: isElectronBuild,
  },
};

export default nextConfig;
