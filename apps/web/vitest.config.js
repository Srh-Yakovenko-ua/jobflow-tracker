import { fileURLToPath } from 'node:url';

import babel from '@rolldown/plugin-babel';
import tailwindMerge from '@tailwind-merge/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    babel({
      exclude: [
        /[/\\]node_modules[/\\]/,
        /^\0rolldown\/runtime\.js$/,
        /\.test\.tsx?$/,
        /[/\\]src[/\\]test[/\\]/,
      ],
      plugins: [[fileURLToPath(import.meta.resolve('babel-plugin-react-compiler')), {}]],
    }),
    tailwindcss(),
    tailwindMerge(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tailwind-merge/next/runtime': '@tailwind-merge/vite/runtime',
    },
  },
  test: {
    environment: 'jsdom',
    execArgv: ['--no-experimental-webstorage'],
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});
