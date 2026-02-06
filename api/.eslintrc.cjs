/**
 * ESLint Configuration
 * @module .eslintrc
 *
 * Strict TypeScript linting rules for the IaC Dependency Detection API.
 * Enforces best practices, type safety, and code quality standards.
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/strict',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
      node: {
        extensions: ['.js', '.ts'],
      },
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },
  },
  rules: {
    // TypeScript strict rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true,
      },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/strict-boolean-expressions': [
      'error',
      {
        allowString: false,
        allowNumber: false,
        allowNullableObject: true,
        allowNullableBoolean: false,
        allowNullableString: false,
        allowNullableNumber: false,
        allowAny: false,
      },
    ],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': [
      'error',
      {
        checksVoidReturn: {
          arguments: false,
        },
      },
    ],
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
        fixStyle: 'separate-type-imports',
      },
    ],
    '@typescript-eslint/consistent-type-exports': [
      'error',
      {
        fixMixedExportsWithInlineTypeSpecifier: true,
      },
    ],
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I'],
        filter: {
          regex: '^(Static|Type|Schema|Props|Options|Config|Context|Result|Error)$',
          match: false,
        },
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase'],
      },
      {
        selector: 'enum',
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ['PascalCase', 'UPPER_CASE'],
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'parameter',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'property',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'method',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },
    ],

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
          'object',
          'type',
        ],
        pathGroups: [
          {
            pattern: '@/**',
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
        distinctGroup: true,
      },
    ],
    'import/no-duplicates': ['error', { 'prefer-inline': true }],
    'import/no-cycle': ['error', { maxDepth: 10 }],
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
    'import/first': 'error',
    'import/newline-after-import': 'error',
    'import/no-mutable-exports': 'error',
    'import/no-default-export': 'off', // Allow default exports for Fastify plugins
    'import/prefer-default-export': 'off',

    // General rules
    'no-console': 'error',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../*'],
            message: 'Prefer absolute imports using @/ aliases',
          },
        ],
      },
    ],
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'no-throw-literal': 'error',
    'no-return-await': 'off', // Handled by @typescript-eslint/return-await
    '@typescript-eslint/return-await': ['error', 'in-try-catch'],

    // Complexity rules
    complexity: ['warn', 15],
    'max-depth': ['warn', 4],
    'max-lines-per-function': [
      'warn',
      {
        max: 100,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
    'max-params': ['warn', 5],
  },
  overrides: [
    // Test files
    {
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
      env: {
        'vitest-globals/env': true,
      },
      plugins: ['vitest-globals'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/unbound-method': 'off',
        'max-lines-per-function': 'off',
        'no-console': 'off',
      },
    },
    // Configuration files
    {
      files: ['*.config.ts', '*.config.js', '.eslintrc.cjs'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-default-export': 'off',
      },
    },
    // Migration files
    {
      files: ['migrations/**/*.ts'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.js',
    '*.cjs',
    '*.mjs',
    '!.eslintrc.cjs',
    '*.d.ts',
  ],
};
