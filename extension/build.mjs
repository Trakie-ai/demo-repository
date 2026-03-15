import * as esbuild from "esbuild";

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
