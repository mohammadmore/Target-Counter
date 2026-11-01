/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any cPanel folder.
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    // HMR / file watching can be disabled (e.g. in AI Studio) via DISABLE_HMR=true.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  test: {
    environment: 'node',
  },
});
