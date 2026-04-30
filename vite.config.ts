import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // 相対パス ('./') にすることで GitHub Pages (/kaiju-rampage/) と
  // CrazyGames (任意のサブパス) の両方で同じビルド成果物が動作する
  base: './',
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        prototype90: path.resolve(__dirname, 'prototype-90.html'),
      },
    },
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
