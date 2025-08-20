import { build, context } from "esbuild";
import { mkdir, rm, cp, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = __dirname;
const DIST = join(ROOT, "dist");
const PUBLIC_SRC = join(ROOT, "public");
const PUBLIC_DIST = join(DIST, "public");

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function clean() {
  await rm(DIST, { recursive: true, force: true });
}

async function copyPublic() {
  await ensureDir(PUBLIC_DIST);
  await cp(PUBLIC_SRC, PUBLIC_DIST, { recursive: true });
}

async function writePublicFromLegacy() {
  // If public folder not present, synthesize it from legacy files
  try {
    await ensureDir(PUBLIC_SRC);
    const files = [
      [join(ROOT, "index.html"), join(PUBLIC_SRC, "index.html")],
      [join(ROOT, "viewer.html"), join(PUBLIC_SRC, "viewer.html")],
      [join(ROOT, "phrases.json"), join(PUBLIC_SRC, "phrases.json")],
      [join(ROOT, "events.json"), join(PUBLIC_SRC, "events.json")],
    ];
    for (const [src, dst] of files) {
      try {
        const s = await readFile(src);
        await writeFile(dst, s);
      } catch {}
    }
    await cp(join(ROOT, "audio"), join(PUBLIC_SRC, "audio"), {
      recursive: true,
      force: true,
    }).catch(() => {});
    await cp(join(ROOT, "vendor"), join(PUBLIC_SRC, "vendor"), {
      recursive: true,
      force: true,
    }).catch(() => {});
  } catch {}
}

async function buildAll({ watch } = { watch: false }) {
  await clean();
  await writePublicFromLegacy();
  await copyPublic();
  // Also copy top-level images used by HTML with relative paths
  try {
    await cp(join(ROOT, "../icon.png"), join(DIST, "icon.png"));
  } catch {}

  // Main + preload (Node/Electron)
  const nodeOpts = {
    entryPoints: [join(ROOT, "src/main.ts"), join(ROOT, "src/preload.ts")],
    outdir: DIST,
    bundle: true,
    platform: "node",
    target: "node18",
    sourcemap: true,
    external: ["electron"],
    format: "cjs",
    logLevel: "info",
  };
  if (watch) {
    const ctx = await context(nodeOpts);
    await ctx.watch();
  } else {
    await build(nodeOpts);
  }

  // Renderer bundles (browser)
  const rendererOpts = {
    entryPoints: [
      join(ROOT, "src/renderer/index.ts"),
      join(ROOT, "src/renderer/viewer.ts"),
    ],
    outdir: join(DIST, "renderer"),
    bundle: true,
    platform: "browser",
    target: "es2020",
    sourcemap: true,
    logLevel: "info",
  };
  if (watch) {
    const ctx = await context(rendererOpts);
    await ctx.watch();
  } else {
    await build(rendererOpts);
  }

  // No longer copy renderer bundles into public; HTML will reference ../renderer/*.js
}

const watch = process.argv.includes("--watch");
buildAll({ watch }).catch((e) => {
  console.error(e);
  process.exit(1);
});
