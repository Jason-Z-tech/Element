import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

// Relative Basis: Die Seite läuft unter jedem Pfad, also auch auf GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [preact()],
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
