import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: { include: ['src/**/*.ts'], exclude: ['src/web/prototype-transform.ts'] },
  },
});
