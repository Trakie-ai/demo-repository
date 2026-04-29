import * as esbuild from "esbuild";
import { readFileSync } from "fs";

// Load .env.local (esbuild doesn't read dotenv files automatically)
try {
  const envFile = readFileSync(".env.local", "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key && rest.length) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  }
} catch {
  // .env.local not found, use defaults
}

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  format: "esm",
  outdir: "dist",
  sourcemap: true,
  target: "es2022",
  minify: !watch,
  define: {
    "process.env.RELAY_URL": JSON.stringify(
      process.env.RELAY_URL || "http://localhost:3001"
    ),
    "process.env.MOBILE_URL": JSON.stringify(
      process.env.MOBILE_URL || "http://localhost:3000"
    ),
    "process.env.TRAKIE_API_URL": JSON.stringify(
      process.env.TRAKIE_API_URL || "https://trakie.ai"
    ),
  },
};

const entryPoints = ["src/popup.ts", "src/background.ts"];

if (watch) {
  const ctx = await esbuild.context({ ...shared, entryPoints });
  await ctx.watch();
  console.log("[esbuild] watching for changes…");
} else {
  await esbuild.build({ ...shared, entryPoints });
  console.log("[esbuild] build complete");
}
