import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    // Property-based tests: fixed seed in CI for reproducibility, 10 000 runs nightly (see README).
  },
});
