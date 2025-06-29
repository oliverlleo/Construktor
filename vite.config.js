import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  base: '/Construktor.io/', // Mantenha esta linha para o GitHub Pages
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // <-- Adicione esta seção
    },
  },
})