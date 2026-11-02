import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [repositoryOwner, repositoryName] = (process.env.GITHUB_REPOSITORY || "").split("/");
const base = repositoryName && repositoryName !== `${repositoryOwner}.github.io`
  ? `/${repositoryName}/`
  : "/";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      input: path.join(projectRoot, "dev.html"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
