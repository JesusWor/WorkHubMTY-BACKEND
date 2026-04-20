import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true }); // carga antes que todo

export default defineConfig({
  test: {
    // coverage: { enabled: true },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/**/*.integration.test.ts'],
          environment: 'node',
          globalSetup: ['./tests/globalSetup.ts'],
          setupFiles: ['./tests/setup.ts'],
          maxWorkers: 1,
          sequence: { concurrent: false },
        },
      },
    ],
  },
});