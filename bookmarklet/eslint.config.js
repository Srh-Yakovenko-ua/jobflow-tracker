import { base } from '@jobflow/config/eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig(base(import.meta.dirname));
