import { api } from '@jobflow/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  globalIgnores(['src/generated/', 'dist-worker/', 'dist-seed/']),
  api(import.meta.dirname),
  {
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: ['src/**/*.middleware.ts'],
    rules: { '@typescript-eslint/max-params': ['error', { max: 3 }] },
  },
);
