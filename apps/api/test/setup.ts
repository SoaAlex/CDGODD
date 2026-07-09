import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeEach } from 'vitest';

// Each test FILE gets an isolated D1 (own workerd isolate); within a file
// state persists across tests. Apply migrations once, then wipe + reseed
// before every test so each one starts from the canonical seed (3 categories,
// 6 approved items, deterministic ids thanks to the sqlite_sequence reset).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
await seed();

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM votes`),
    env.DB.prepare(`DELETE FROM reports`),
    env.DB.prepare(`DELETE FROM item_categories`),
    env.DB.prepare(`DELETE FROM item_translations`),
    env.DB.prepare(`DELETE FROM items`),
    env.DB.prepare(`DELETE FROM category_translations`),
    env.DB.prepare(`DELETE FROM categories`),
    env.DB.prepare(`DELETE FROM sqlite_sequence`),
  ]);
  await seed();
});

async function seed(): Promise<void> {
  for (const stmt of env.TEST_SEED) {
    await env.DB.prepare(stmt).run();
  }
}
