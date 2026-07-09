import type { D1Migration } from 'cloudflare:test';
import type { Env as WorkerEnv } from '../src/env';

declare global {
  namespace Cloudflare {
    // Bindings visible to tests (`env` from cloudflare:test): the worker's
    // own Env plus test-only bindings injected from vitest.config.ts.
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
      TEST_SEED: string[];
    }
  }
}
