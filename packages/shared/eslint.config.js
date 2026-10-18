import { base } from '@jobflow/config/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(globalIgnores(['tokens/generated/']), base(import.meta.dirname));
