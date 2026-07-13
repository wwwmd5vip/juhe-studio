import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      'no-console': 'off',
      // preserve-caught-error requires cause on re-throws — significant refactor needed
      'preserve-caught-error': 'off'
    }
  },
  {
    files: ['src/main/**/*.ts', 'packages/*/scripts/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      // Scripts and config files use require()
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      'out/**',
      'build/**',
      'coverage/**',
      '**/*.gen.ts',
      'src/main/db/migrations/**',
      'src/shared/ecommerce-workflow/prompts/generate-registry.js',
      'packages/volcengine-nodejs-sdk/**'
    ]
  }
)
