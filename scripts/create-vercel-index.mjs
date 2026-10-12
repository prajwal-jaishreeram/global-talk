import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve, dirname } from "path";
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "dist/client");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

await build({
  root,
  configFile: false,
  plugins: [tsconfigPaths(), tailwindcss(), react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir,
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(root, "src/vercel-client.tsx"),
      output: {
        entryFileNames: "assets/vercel-client-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});

const assetsDir = resolve(outDir, "assets");
const files = readdirSync(assetsDir);
const entryJs = files.find(
  (f) => f.startsWith("vercel-client-") && f.endsWith(".js"),
);
if (!entryJs) {
  throw new Error("Could not find vercel-client entry JS in dist/client/assets");
}
const cssFiles = files.filter((f) => f.endsWith(".css"));

const cssTags = cssFiles
  .map((f) => `  <link rel="stylesheet" href="/assets/${f}">`)
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentCall</title>
${cssTags}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/${entryJs}"></script>
</body>
</html>
`;

writeFileSync(resolve(outDir, "index.html"), html);
writeFileSync(resolve(outDir, "404.html"), html);

console.log(`Wrote ${resolve(outDir, "index.html")}`);
console.log(`Wrote ${resolve(outDir, "404.html")}`);
console.log(`Entry: /assets/${entryJs}`);
console.log(`CSS:   ${cssFiles.map((f) => "/assets/" + f).join(", ") || "(none)"}`);