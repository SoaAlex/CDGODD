import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from './env';
import { identity } from './security';
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
export default app;
