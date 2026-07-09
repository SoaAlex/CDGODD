import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, 'migrations'),
      );
      // seed.sql contains `--` comment lines; strip them, then split on ';'.
      const seed = readFileSync(
        path.join(import.meta.dirname, 'src/db/seed.sql'),
        'utf8',
      )
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            TEST_SEED: seed,
            // Pinned so .dev.vars can never leak into tests.
            ADMIN_TOKEN: 'test-admin-token',
            CDN_BASE: 'https://cdn.test',
          },
        },
      };
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
