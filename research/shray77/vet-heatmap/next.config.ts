import type { NextConfig } from "next";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
let withBundleAnalyzer = (config: NextConfig) => config;
if (process.env.ANALYZE === "true") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundleAnalyzer = require("@next/bundle-analyzer");
    withBundleAnalyzer = bundleAnalyzer({ enabled: true });
  } catch {
    // bundle-analyzer optional when not analyzing
  }
}

const isProd = process.env.NODE_ENV === "production";
// GitHub Pages serves the site at /vet-heatmap/ subpath.
// For local dev (npm run dev) we use root.
const basePath = isProd ? "/vet-heatmap" : "";
const assetPrefix = isProd ? "/vet-heatmap/" : undefined;

// ─── Cache-busting version stamp ────────────────────────────────────────
// Generate a unique version string on every build so the service worker
// invalidates ALL caches (HTML, JS, CSS, JSON) when the app is redeployed.
// Format: <package.version>+<git-sha-short>, e.g. "1.4.2+abc1234".
// Falls back to timestamp if git is unavailable.
function getBuildVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    const pkgVersion = pkg.version || "0.0.0";
    let gitSha = "";
    try {
      gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    } catch {
      // git not available (CI shallow clone? detached HEAD?) — use timestamp
      gitSha = String(Date.now());
    }
    return `${pkgVersion}+${gitSha}`;
  } catch {
    return `dev+${Date.now()}`;
  }
}

const BUILD_VERSION = getBuildVersion();

// Write the version to public/version.json so the service worker can read
// it at runtime. SW fetches /vet-heatmap/version.json on install/activate
// and uses it as CACHE_VERSION — different version = different cache name =
// old caches deleted. This means EVERY deploy auto-busts the cache without
// manually editing vetkart-sw.js.
writeFileSync(
  resolve("public/version.json"),
  JSON.stringify({ version: BUILD_VERSION, built: new Date().toISOString() }, null, 2),
);

console.log(`[next.config] Build version: ${BUILD_VERSION}`);

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    root: resolve(__dirname),
  },
  // GitHub Pages needs /vet-heatmap subpath in production
  basePath,
  assetPrefix,
  // Static export doesn't need image optimization
  images: { unoptimized: true },
  // MapLibre needs to be transpiled (it has some ESM edge cases)
  transpilePackages: ["maplibre-gl"],
  // Expose BUILD_VERSION to client via process.env.NEXT_PUBLIC_BUILD_VERSION
  // — used by the app to display the current version in About dialog.
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
  // Type checking is now enforced in production builds — all tsc errors
  // have been resolved. Previously `ignoreBuildErrors: true` was needed
  // because of pre-existing type mismatches (MapLibre 5.x API, recharts 3.x
  // Tooltip types, Enterprise type union). These were fixed in commit
  // 9d126b7 + this commit. Lint + tests + tsc all pass clean.
  typescript: { ignoreBuildErrors: false },
  // Strict mode causes double-mount of effects in dev, which breaks MapLibre
  // init in some edge cases. Disable for stable production behavior.
  reactStrictMode: false,
};

export default withBundleAnalyzer(nextConfig);
