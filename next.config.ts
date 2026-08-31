import { execSync } from "node:child_process";

import type { NextConfig } from "next";

/**
 * Version skew protection. A till that keeps its POS tab open across a deploy
 * kept calling Server Actions the new build no longer knows ("Failed to find
 * Server Action" — it happened on 10 of the last 30 days), which reached the
 * cashier as a failed save. With a deployment id, Next spots the mismatch and
 * does a full page load instead; the open bill survives that, because the POS
 * keeps its cart in localStorage.
 *
 * Deploys are `git pull` → `npm run build` → restart, so the commit is the
 * natural id: it changes exactly once per deploy, and the build and the running
 * server read it from the same checkout.
 */
function resolveDeploymentId(): string | undefined {
  if (process.env.NEXT_DEPLOYMENT_ID) return process.env.NEXT_DEPLOYMENT_ID;
  try {
    return (
      execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim() || undefined
    );
  } catch {
    // No git checkout to read (a copied tree, say) — skip skew protection
    // rather than pinning every deploy to the same id.
    return undefined;
  }
}

const nextConfig: NextConfig = {
  deploymentId: resolveDeploymentId(),
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
  serverExternalPackages: ["pg"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
