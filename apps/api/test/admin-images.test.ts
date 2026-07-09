import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_HEADERS, api } from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

function fromSource(itemId: number | string, body: unknown): Promise<Response> {
  return api(`/admin/items/${itemId}/image-from-source`, {
    method: 'POST',
    headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const WIKI_PICK = {
  source: 'wikimedia',
  fullUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/x.jpg',
  license: 'CC BY-SA 4.0',
  sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:x.jpg',
  author: 'Jane Doe',
};

describe('POST /admin/items/:id/image-from-source', () => {
  it('refuses disallowed hosts without ever fetching (SSRF guard)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const evil = await fromSource(1, {
      ...WIKI_PICK,
      fullUrl: 'https://evil.com/x.jpg',
    });
    expect(evil.status).toBe(400);
    expect(await evil.json()).toEqual({ error: 'host not allowed' });

    // Cross-source spoof: pixabay host under wikimedia source.
    const spoof = await fromSource(1, {
      ...WIKI_PICK,
      fullUrl: 'https://pixabay.com/x.jpg',
    });
    expect(spoof.status).toBe(400);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('copies an allowed image to R2 and stores attribution', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'content-type': 'image/jpeg' },
          }),
      ),
    );

    const res = await fromSource(1, WIKI_PICK);
    expect(res.status).toBe(200);
    const { imageKey } = (await res.json()) as { imageKey: string };
    expect(await env.IMAGES.get(imageKey)).not.toBeNull();

    const item = await env.DB.prepare(
      `SELECT image_key, image_source, image_author, image_license,
              image_source_url FROM items WHERE id = 1`,
    ).first();
    expect(item).toEqual({
      image_key: imageKey,
      image_source: 'wikimedia',
      image_author: 'Jane Doe',
      image_license: 'CC BY-SA 4.0',
      image_source_url: WIKI_PICK.sourcePageUrl,
    });
  });

  it('502s when the source does not serve an image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('nope', { headers: { 'content-type': 'text/html' } }),
      ),
    );
    expect((await fromSource(1, WIKI_PICK)).status).toBe(502);
  });

  it('400s when the image exceeds 8 MB', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new Uint8Array(8 * 1024 * 1024 + 1), {
            headers: { 'content-type': 'image/jpeg' },
          }),
      ),
    );
    const res = await fromSource(1, WIKI_PICK);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'image too large' });
  });

  it('validates item, source and required fields', async () => {
    expect((await fromSource(999, WIKI_PICK)).status).toBe(404);
    expect((await fromSource(1, { ...WIKI_PICK, source: 'imgur' })).status).toBe(400);
    expect((await fromSource(1, { ...WIKI_PICK, license: '' })).status).toBe(400);
    expect((await fromSource(1, { ...WIKI_PICK, fullUrl: 'not a url' })).status).toBe(400);
  });
});

describe('GET /admin/image-candidates', () => {
  it('filters non-free licenses and rewrites grid thumbs', async () => {
    const wikimediaJson = {
      query: {
        pages: {
          '1': {
            imageinfo: [
              {
                thumburl:
                  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Free.jpg/1024px-Free.jpg',
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Free.jpg',
                mime: 'image/jpeg',
                extmetadata: {
                  LicenseShortName: { value: 'CC BY 4.0' },
                  Artist: { value: '<a href="#">Jane</a>' },
                },
              },
              {
                thumburl:
                  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/NC.jpg/1024px-NC.jpg',
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:NC.jpg',
                mime: 'image/jpeg',
                extmetadata: { LicenseShortName: { value: 'CC BY-NC 4.0' } },
              },
              {
                thumburl:
                  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Vid.webm/1024px-Vid.webm',
                descriptionurl: 'https://commons.wikimedia.org/wiki/File:Vid.webm',
                mime: 'video/webm',
                extmetadata: { LicenseShortName: { value: 'CC0' } },
              },
            ],
          },
        },
      },
    };
    // Wrap page entries: the route expects one imageinfo array per page.
    const pages = Object.fromEntries(
      wikimediaJson.query.pages['1']!.imageinfo.map((info, i) => [
        String(i + 1),
        { imageinfo: [info] },
      ]),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ query: { pages } })),
    );

    const res = await api('/admin/image-candidates?q=test', {
      headers: ADMIN_HEADERS,
    });
    expect(res.status).toBe(200);
    const { candidates } = (await res.json()) as {
      candidates: Array<{
        source: string;
        license: string;
        author: string | null;
        thumbUrl: string;
      }>;
    };
    // NC license and non-image mime filtered; PIXABAY_KEY unset → wikimedia only.
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      source: 'wikimedia',
      license: 'CC BY 4.0',
      author: 'Jane', // HTML stripped
    });
    expect(candidates[0]!.thumbUrl).toContain('/330px-');
  });

  it('degrades to an empty list when the upstream search fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const res = await api('/admin/image-candidates?q=test', {
      headers: ADMIN_HEADERS,
    });
    expect(await res.json()).toEqual({ candidates: [] });
  });

  it('400s on a missing or oversized query', async () => {
    expect(
      (await api('/admin/image-candidates', { headers: ADMIN_HEADERS })).status,
    ).toBe(400);
    expect(
      (
        await api(`/admin/image-candidates?q=${'a'.repeat(101)}`, {
          headers: ADMIN_HEADERS,
        })
      ).status,
    ).toBe(400);
  });
});

describe('POST /admin/items/:id/ai-image', () => {
  const FAKE_JPEG = btoa('fake-jpeg-bytes');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates via Workers AI (mocked) and stores the image', async () => {
    // Never call through: the AI binding hits the real, billed API even in
    // local dev. Replace run() wholesale.
    const run = vi.fn(async () => ({ image: FAKE_JPEG }));
    env.AI = { run } as unknown as Ai;

    const res = await api('/admin/items/1/ai-image', {
      method: 'POST',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const { imageKey } = (await res.json()) as { imageKey: string };

    expect(run).toHaveBeenCalledWith(
      '@cf/black-forest-labs/flux-1-schnell',
      expect.objectContaining({
        prompt: expect.stringContaining('Le quinoa'),
        steps: 8,
      }),
    );
    expect(await env.IMAGES.get(imageKey)).not.toBeNull();

    const item = await env.DB.prepare(
      `SELECT image_source, image_license FROM items WHERE id = 1`,
    ).first();
    expect(item).toEqual({ image_source: 'ai', image_license: 'ai-generated' });
  });

  it('502s when generation returns no image', async () => {
    env.AI = { run: vi.fn(async () => ({})) } as unknown as Ai;
    const res = await api('/admin/items/1/ai-image', {
      method: 'POST',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(502);
  });

  it('404s on an unknown item', async () => {
    env.AI = { run: vi.fn() } as unknown as Ai;
    const res = await api('/admin/items/999/ai-image', {
      method: 'POST',
      headers: { ...ADMIN_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});
