import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
plugins: [
react(),
],
  server: {
    port: 3000, // Default port for development
    strictPort: true, // Ensure the port is fixed and doesn't change
    host: "localhost", // Use localhost as the host
  },
  clearScreen: false, // Optional: prevents Vite from clearing console on reload
});
