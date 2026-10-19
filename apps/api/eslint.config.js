import { api } from '@jobflow/config/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(
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
