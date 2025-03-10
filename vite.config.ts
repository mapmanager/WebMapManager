import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteTsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/WebMapManager/",
  build: {
    outDir: "build",
  },
  plugins: [
    react({
      babel: {
        plugins: [["module:@preact/signals-react-transform"]],
      },
    }),
    viteTsconfigPaths(),
    tailwindcss(),
  ],
  server: {
    open: true,
    port: 3001,
  },
  define: {
    "process.env": process.env,
    global: {},
  },
  resolve: {
    alias: {
      process: "process/browser",
      buffer: "buffer",
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      assert: "assert",
      os: "os-browserify",
      url: "url",
      util: "util",
    },
  },
});
