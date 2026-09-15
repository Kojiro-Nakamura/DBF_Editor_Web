import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/DBF_Editor_Web/',
  plugins: [tailwindcss()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});
