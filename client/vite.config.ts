import { createLogger, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const logger = createLogger();
const originalInfo = logger.info.bind(logger);
logger.info = (msg, options) => {
  // Suppress Vite's default startup banner — our server prints its own
  if (
    msg.includes("Local") || msg.includes("Network") ||
    msg.includes("ready in") || msg.includes("VITE")
  ) {
    return;
  }
  originalInfo(msg, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@zone-blitz/shared": resolve(__dirname, "../packages/shared/mod.ts"),
      "@zone-blitz/server": resolve(__dirname, "../server/main.ts"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        configure: (proxy) => {
          const originalEmit = proxy.emit.bind(proxy);
          proxy.emit = (event: string, ...args: unknown[]) => {
            if (
              event === "error" &&
              args[0] instanceof Error &&
              /abort|cancel/i.test(args[0].message)
            ) {
              return true;
            }
            return originalEmit(event, ...args);
          };
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: [],
    coverage: {
      provider: "v8",
      enabled: true,
      include: ["src/**"],
      exclude: ["src/main.tsx"],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
