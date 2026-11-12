// Builds a single self-contained HTML file with the in-browser mock API (demo/preview only).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('true') },
  build: { outDir: 'dist-demo', emptyOutDir: true },
});
