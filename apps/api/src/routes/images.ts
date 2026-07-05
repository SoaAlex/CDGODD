import { Hono } from 'hono';
import type { AppContext } from '../env';

const images = new Hono<AppContext>();

/**
 * GET /img/* — serve card images from R2.
 * Local dev origin, and the fallback origin behind Cloudflare's cache in
 * prod (long immutable cache headers: keys are content-unique UUIDs).
 */
images.get('/img/*', async (c) => {
  const key = c.req.path.replace(/^\/img\//, '');
  if (!key) return c.notFound();

  const object = await c.env.IMAGES.get(key);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      'content-type':
        object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      etag: object.httpEtag,
    },
  });
});

export default images;
