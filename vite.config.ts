import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "2004SoftailHeritage";

export default defineConfig({
  plugins: [react()],
  base: isGitHubActions ? `/${repositoryName}/` : "/"
});
