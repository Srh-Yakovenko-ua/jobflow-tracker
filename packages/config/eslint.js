import path from 'node:path';

import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export function base(rootDir) {
  return defineConfig(
    globalIgnores(['dist/', '.next/', 'coverage/', '.turbo/']),
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: rootDir,
        },
      },
    },
    {
      files: [tseslint.globs.js],
      extends: [tseslint.configs.disableTypeChecked],
      languageOptions: { globals: globals.node },
    },
    {
      plugins: { 'simple-import-sort': simpleImportSort },
      rules: {
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
        'no-console': 'error',
        'no-restricted-syntax': [
          'error',
          {
            selector: 'TSEnumDeclaration',
            message: 'Use an as const object with a union type instead of an enum.',
          },
        ],
      },
    },
  );
}

export function api(rootDir) {
  return defineConfig(base(rootDir), {
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': rootDir,
      'boundaries/elements': [
        { type: 'module', pattern: 'src/modules/*', capture: ['name'] },
        { type: 'app', pattern: 'src' },
      ],
      'import/resolver': {
        typescript: { project: path.join(rootDir, 'tsconfig.json') },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            { disallow: { to: { element: { type: 'module' } } } },
            { allow: { to: { element: { type: 'module', fileInternalPath: 'index.ts' } } } },
          ],
        },
      ],
    },
  });
}

export function web(rootDir) {
  return defineConfig(
    base(rootDir),
    {
      files: [tseslint.globs.ts],
      extends: [eslintReact.configs['recommended-typescript']],
      rules: {
        '@eslint-react/error-boundaries': 'off',
        '@eslint-react/exhaustive-deps': 'off',
        '@eslint-react/purity': 'off',
        '@eslint-react/rules-of-hooks': 'off',
        '@eslint-react/set-state-in-effect': 'off',
        '@eslint-react/set-state-in-render': 'off',
        '@eslint-react/static-components': 'off',
        '@eslint-react/unsupported-syntax': 'off',
        '@eslint-react/use-memo': 'off',
      },
    },
    reactHooks.configs.flat.recommended,
    nextPlugin.configs['core-web-vitals'],
    {
      languageOptions: { globals: globals.browser },
      settings: { next: { rootDir } },
    },
  );
}
