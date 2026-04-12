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
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: [],
  },
});
