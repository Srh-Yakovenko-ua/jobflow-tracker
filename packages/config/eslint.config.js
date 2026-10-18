import { defineConfig, globalIgnores } from 'eslint/config';

import { base } from './eslint.js';

export default defineConfig(base(import.meta.dirname), globalIgnores(['test/fixtures/']));
