import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@poke-bench/agents",
    "@poke-bench/db",
    "@poke-bench/dex",
    "@poke-bench/shared",
    "@poke-bench/sim",
    "@poke-bench/tournament",
  ],
};

export default nextConfig;
