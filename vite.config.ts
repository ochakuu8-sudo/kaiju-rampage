import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/kaiju-rampage/',
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
