import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createRequire } from "module";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const require = createRequire(import.meta.url);
const reactDir = path.dirname(require.resolve("react/package.json"));
const reactDomDir = path.dirname(require.resolve("react-dom/package.json"));

const isBuild = process.argv.includes("build");

const rawPort = process.env.PORT;
if (!isBuild) {
  if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const port = rawPort ? Number(rawPort) : 3000;

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      react: reactDir,
      "react-dom": reactDomDir,
    },
    dedupe: ["react", "react-dom", "wouter"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "wouter"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          charts: ["recharts"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "@radix-ui/react-select"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
