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

import {
  HAND_WRITTEN_QUERY_KEY,
  NEST_MAX_PARAMS,
  RAW_COLOUR,
  RESTRICTED_SYNTAX,
  USER_ID_FIRST,
} from './restricted-syntax.js';

const LINE_COUNT = { skipBlankLines: true, skipComments: true };

const SHAPE_RULES = {
  'max-params': 'off',
  '@typescript-eslint/max-params': ['error', { max: 2 }],
  'max-lines-per-function': ['error', { ...LINE_COUNT, max: 40 }],
  'max-lines': ['error', { ...LINE_COUNT, max: 200 }],
  'max-depth': ['error', 3],
  complexity: ['error', 10],
  'max-nested-callbacks': ['error', 3],
};

const NEST_ROLE_FILES = [
  '**/*.module.ts',
  '**/*.service.ts',
  '**/*.controller.ts',
  '**/*.repository.ts',
  '**/*.processor.ts',
];

const TEST_FILES = ['**/*.test.ts', '**/*.test.tsx', '**/test/**'];

const SHAPE_OVERRIDES = [
  {
    files: ['**/*.tsx'],
    rules: { 'max-lines-per-function': ['error', { ...LINE_COUNT, max: 80 }] },
  },
  {
    files: NEST_ROLE_FILES,
    rules: {
      '@typescript-eslint/max-params': 'off',
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX, NEST_MAX_PARAMS],
    },
  },
  {
    files: TEST_FILES,
    rules: { 'max-lines-per-function': 'off', 'max-lines': 'off' },
  },
];

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
        'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
        ...SHAPE_RULES,
      },
    },
    SHAPE_OVERRIDES,
  );
}

function boundariesBlock(rootDir, { elements, dependencies }) {
  return {
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': rootDir,
      'boundaries/elements': elements,
      'import/resolver': {
        typescript: { project: path.join(rootDir, 'tsconfig.json') },
      },
    },
    rules: { 'boundaries/dependencies': ['error', dependencies] },
  };
}

export function api(rootDir) {
  return defineConfig(
    base(rootDir),
    boundariesBlock(rootDir, {
      elements: [
        { type: 'module', pattern: 'src/modules/*', capture: ['name'] },
        { type: 'app', pattern: 'src' },
      ],
      dependencies: {
        default: 'allow',
        policies: [
          { disallow: { to: { element: { type: 'module' } } } },
          { allow: { to: { element: { type: 'module', fileInternalPath: 'index.ts' } } } },
        ],
      },
    }),
    {
      files: ['src/modules/*/*.repository.ts'],
      ignores: ['src/modules/auth/**'],
      rules: {
        'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX, NEST_MAX_PARAMS, USER_ID_FIRST],
      },
    },
  );
}

const FSD_LAYERS = [
  { type: 'app', pattern: 'src/app' },
  { type: 'widgets', pattern: 'src/widgets/*', capture: ['slice'] },
  { type: 'features', pattern: 'src/features/*', capture: ['slice'] },
  { type: 'entities', pattern: 'src/entities/*', capture: ['slice'] },
  { type: 'shared', pattern: 'src/shared' },
];

function publicApiOf(layer) {
  return layer.capture
    ? { element: { type: layer.type, fileInternalPath: 'index.ts' } }
    : { element: { type: layer.type } };
}

function sameSliceOf(layer) {
  const captured = { slice: '{{ from.element.captured.slice }}' };
  return layer.capture ? [{ element: { type: layer.type, captured } }] : [];
}

const FSD_POLICIES = FSD_LAYERS.map((layer, index) => ({
  from: { element: { type: layer.type } },
  allow: { to: [...sameSliceOf(layer), ...FSD_LAYERS.slice(index + 1).map(publicApiOf)] },
})).filter((policy) => policy.allow.to.length > 0);

const WEB_RESTRICTED_SYNTAX = [...RESTRICTED_SYNTAX, ...RAW_COLOUR, ...HAND_WRITTEN_QUERY_KEY];

export function web(rootDir) {
  return defineConfig(
    globalIgnores(['next-env.d.ts']),
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
    {
      files: [tseslint.globs.ts],
      rules: { 'no-restricted-syntax': ['error', ...WEB_RESTRICTED_SYNTAX] },
    },
    reactHooks.configs.flat.recommended,
    nextPlugin.configs['core-web-vitals'],
    {
      languageOptions: { globals: globals.browser },
      settings: { next: { rootDir } },
    },
    boundariesBlock(rootDir, {
      elements: FSD_LAYERS,
      dependencies: { default: 'disallow', policies: FSD_POLICIES },
    }),
  );
}
