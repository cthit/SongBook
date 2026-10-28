import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Sign in and export links go to route handlers, which must not use client side navigation
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'next-env.d.ts',
    'test-results/**',
    'playwright-report/**',
    'node_modules/**',
  ]),
])
