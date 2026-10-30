import path from "path"

const githubRepository = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base =
  process.env.GITHUB_ACTIONS === 'true' && githubRepository && !githubRepository.endsWith('.github.io')
    ? `/${githubRepository}/`
    : '/'
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import gameBuildOutput from "./scripts/build-output"

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), gameBuildOutput()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
