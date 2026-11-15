import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    environment: 'jsdom'
    // isolate stays on (the default): each test file gets its own fresh modules, so one file's
    // vi.mock('./api/client.ts') can't leak into another file that already loaded the same component.
  }
});
