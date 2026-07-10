import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext, Env } from './env';
import { identity, IP_HASH_WINDOW_MS } from './security';
import images from './routes/images';
import items from './routes/items';
import votes from './routes/votes';
import submissions from './routes/submissions';
import reports from './routes/reports';
import rooms from './routes/rooms';
import admin from './routes/admin';

const app = new Hono<AppContext>();

app.use('*', cors());
app.use('*', identity);

app.get('/', (c) => c.json({ name: 'cdgodd-api', ok: true }));

app.route('/', images);
app.route('/', items);
app.route('/', votes);
app.route('/', submissions);
app.route('/', reports);
app.route('/', rooms);
app.route('/admin', admin);

export { Room } from './durable/Room';

export default {
  fetch: app.fetch,

  /**
   * Daily cron (wrangler.toml [triggers]): GDPR data minimization. Tallies
   * live in items counters; an old ip_hash serves nothing once its vote is
   * outside the IP_HASH_WINDOW_MS cap window, so drop it.
   */
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await env.DB.prepare(
      `UPDATE votes SET ip_hash = NULL
        WHERE ip_hash IS NOT NULL AND created_at < ?1`,
    )
      .bind(Date.now() - IP_HASH_WINDOW_MS)
      .run();
  },
};
