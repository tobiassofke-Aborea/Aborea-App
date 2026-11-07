import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  // Ergebnis direkt in den veröffentlichten Ordner kampf-tracker/ im Repo schreiben
  build: {
    outDir: resolve(__dirname, "../../kampf-tracker"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
  server: { cors: true },
});
