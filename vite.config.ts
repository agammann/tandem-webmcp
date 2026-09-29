import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  server: { host: 'localhost', port: 3000, strictPort: true },
  preview: { host: 'localhost', port: 3000, strictPort: true },
  build: { outDir: 'dist/client' },
});
