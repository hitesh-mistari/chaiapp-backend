
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        teardownTimeout: 5000,
        testTimeout: 10000,
        setupFiles: ['./test/setup.ts'],
    },
});
