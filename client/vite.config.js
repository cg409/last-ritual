import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

// The game rules live in ../shared so the server and the browser (singleplayer) run identical code.
export default defineConfig({
  resolve: { alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) } },
  server: { port: 5173, fs: { allow: ['..'] } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
