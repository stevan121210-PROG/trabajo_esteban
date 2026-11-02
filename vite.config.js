import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const [repositoryOwner, repositoryName] = (process.env.GITHUB_REPOSITORY || "").split("/");
const base = repositoryName && repositoryName !== `${repositoryOwner}.github.io`
  ? `/${repositoryName}/`
  : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
