import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_HEADERS, api } from './helpers';

describe('admin auth', () => {
  afterEach(() => {
    env.ADMIN_TOKEN = 'test-admin-token';
  });

  it('401s without a token', async () => {
    const res = await api('/admin/stats');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('401s with a wrong token', async () => {
    const res = await api('/admin/stats', {
      headers: { authorization: 'Bearer nope' },
    });
    expect(res.status).toBe(401);
  });

  it('200s with the right bearer token', async () => {
    const res = await api('/admin/stats', { headers: ADMIN_HEADERS });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totals: { items: number; votesLeft: number; votesRight: number };
    };
    expect(body.totals.items).toBe(6);
  });

  it('401s everything when ADMIN_TOKEN is unset (fail closed)', async () => {
    env.ADMIN_TOKEN = undefined;
    const res = await api('/admin/stats', { headers: ADMIN_HEADERS });
    expect(res.status).toBe(401);
  });
});
