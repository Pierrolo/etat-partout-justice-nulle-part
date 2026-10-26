// Flat config — deliberately minimal: correctness rules only, formatting is Prettier's job.
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.astro/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // not ours to lint: harvested data, research notes, python pipeline & scripts, generated JSON
      'data/**',
      'research/**',
      'docs/**',
      'scripts/**',
      'pipeline/**',
      'site/src/data/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      // French typography uses NBSP / narrow NBSP on purpose.
      'no-irregular-whitespace': [
        'error',
        {
          skipStrings: true,
          skipTemplates: true,
          skipJSXText: true,
          skipComments: true,
          skipRegExps: true,
        },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Stale closures are the classic bug of hook-heavy islands: rules-of-hooks is an error,
    // exhaustive-deps a warning to review (a dependency omitted on purpose gets a comment).
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/triple-slash-reference': 'off' },
  },
  {
    // `<script is:inline>` blocks run as-is in every browser, before any bundle: `var` and empty `catch`
    // (storage blocked) are deliberate there.
    files: ['**/*.astro', '**/*.astro/*.{js,ts}'],
    rules: {
      'no-var': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  {
    // CLI scripts may print.
    files: ['**/scripts/**', '**/*.config.{js,mjs,ts}'],
    rules: { 'no-console': 'off' },
  },
);
