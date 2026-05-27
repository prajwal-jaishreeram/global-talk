// @lovable.dev/vite-tanstack-config already includes the following for local builds.
// Keep the manual plugin chain below scoped to Vercel so the app can use Nitro there.
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig as defineViteConfig, type PluginOption, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

type NitroViteModule = {
  nitro: (options?: { preset?: string }) => PluginOption;
};

const isVercelBuild = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";

const sharedViteConfig = {
  resolve: {
    alias: {
      "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
      "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
      "entities": path.resolve(__dirname, "node_modules/entities"),
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: {
    allowedHosts: [".ngrok-free.dev", ".ngrok-free.app", ".ngrok.io", ".trycloudflare.com"],
  },
} satisfies UserConfig;

async function createVercelConfig() {
  // Dynamic import keeps local type checks working until npm install has added Nitro.
  const { nitro } = (await import("nitro" + "/vite")) as NitroViteModule;

  return defineViteConfig({
    ...sharedViteConfig,
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      nitro({ preset: "vercel" }),
      viteReact(),
    ],
  });
}

export default isVercelBuild
  ? await createVercelConfig()
  : defineLovableConfig({
      tanstackStart: {
        server: { entry: "server" },
      },
      vite: sharedViteConfig,
    });
