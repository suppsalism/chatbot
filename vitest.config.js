import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    css: true, // .css imports resolve to the real stylesheet text, as they do in the build
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/umd.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
