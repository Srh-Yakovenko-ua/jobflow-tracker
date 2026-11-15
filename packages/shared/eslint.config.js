import { base } from '@jobflow/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
  globalIgnores(['tokens/generated/', 'src/generated/']),
  base(import.meta.dirname),
);
