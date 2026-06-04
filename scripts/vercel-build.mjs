// Vercel Build Output API generator.
// Produces .vercel/output with:
//   - static/            the Vite-built client (SPA)
//   - functions/api.func a single self-contained esbuild bundle of the Express
//                        API (no extensionless ESM imports, no native deps)
//   - config.json        routing: /api/* -> function, everything else -> SPA
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";

const OUT = ".vercel/output";
const FUNC = `${OUT}/functions/api.func`;

// 1. Build the client (Vite -> dist/public)
execSync("npx vite build", { stdio: "inherit" });

// 2. Reset and scaffold the Build Output directory
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/static`, { recursive: true });
mkdirSync(FUNC, { recursive: true });

// 3. Copy the client into the static output
cpSync("dist/public", `${OUT}/static`, { recursive: true });

// 4. Bundle the serverless Express app into one self-contained ESM file.
//    Everything (express, pg, drizzle, bcryptjs, server/*) is inlined, so there
//    are no relative imports to resolve at runtime. pg-native is optional and
//    not installed, so it stays external.
await build({
  entryPoints: ["api/index.ts"],
  outfile: `${FUNC}/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["pg-native"],
  banner: {
    js: [
      "import { createRequire as __cr } from 'module';",
      "import { fileURLToPath as __furl } from 'url';",
      "import { dirname as __dir } from 'path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __furl(import.meta.url);",
      "const __dirname = __dir(__filename);",
    ].join("\n"),
  },
});

// 5. Function runtime config (Build Output API)
writeFileSync(
  `${FUNC}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: true,
    },
    null,
    2,
  ),
);

// 6. Routing: API to the function, static assets via filesystem, SPA fallback
writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "/api/(.*)", dest: "/api" },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("Build Output API ready at .vercel/output");
