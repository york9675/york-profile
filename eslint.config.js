import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

const noUnusedVarsRule = [
  'warn',
  { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
];

export default [
  {
    ignores: ['node_modules/', 'dist/', '.astro/', 'build/', 'coverage/', 'pnpm-lock.yaml'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser: tseslint.parser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': noUnusedVarsRule,
    },
  },
  ...astro.configs.recommended,
  {
    files: ['**/*.astro'],
    rules: {
      '@typescript-eslint/no-unused-vars': noUnusedVarsRule,
    },
  },
];
