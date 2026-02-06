/**
 * ESLint Configuration for E2E Tests
 * @module e2e/.eslintrc
 *
 * Linting rules optimized for E2E testing code.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'warn',
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',

    // Import rules
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
          'type',
        ],
        pathGroups: [
          {
            pattern: '@e2e/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@support/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@fixtures/**',
            group: 'internal',
            position: 'before',
          },
          {
            pattern: '@api/**',
            group: 'internal',
            position: 'before',
          },
        ],
        pathGroupsExcludedImportTypes: ['type'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'error',
    'import/no-cycle': 'warn',

    // General rules relaxed for tests
    'no-console': 'off', // Allow console in tests for debugging
    'no-empty-pattern': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],

    // Test-specific relaxations
    '@typescript-eslint/no-non-null-assertion': 'off', // Common in tests
    '@typescript-eslint/unbound-method': 'off', // Vitest/Playwright patterns
  },
  overrides: [
    {
      // Playwright tests
      files: ['**/*.pw.ts'],
      rules: {
        '@typescript-eslint/no-floating-promises': 'off', // Playwright handles this
      },
    },
    {
      // Test files
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
    {
      // Config files
      files: ['*.config.ts', '*.config.js'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    'reports/',
    'test-results/',
    'playwright-report/',
    '*.js',
    '!.eslintrc.cjs',
  ],
};
