import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const alias = {
  '@': resolvePath('./src'),
  '@shared': resolvePath('./shared'),
}

// Two projects so server logic runs in Node and React components run in jsdom,
// while sharing one alias map and one coverage report.
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts', 'shared/**/*.test.ts'],
          clearMocks: true,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/__tests__/setup.ts'],
          clearMocks: true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['server/src/**', 'src/**', 'shared/**'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'src/__tests__/**',
        'src/main.tsx', // client bootstrap (DOM mount) — exercised via the app, not units
        'server/src/index.ts', // server bootstrap (listen + static + sweep) — exercised via E2E/HTTP
        '**/*.d.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 82,
        functions: 85,
        lines: 90,
      },
    },
  },
})
