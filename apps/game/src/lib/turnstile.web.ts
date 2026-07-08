const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITEKEY;

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      size: 'invisible';
      callback: (token: string) => void;
      'error-callback': () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptLoading ??= new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = document.createElement('script');
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error('turnstile script failed'));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

/** Run one invisible challenge and resolve with its token. */
async function mintToken(): Promise<string> {
  if (!SITE_KEY) return 'dev';
  await loadScript();
  return new Promise<string>((resolve, reject) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const cleanup = (widgetId?: string) => {
      if (widgetId) window.turnstile?.remove(widgetId);
      host.remove();
    };
    const widgetId = window.turnstile!.render(host, {
      sitekey: SITE_KEY,
      size: 'invisible',
      callback: (token) => {
        cleanup(widgetId);
        resolve(token);
      },
      'error-callback': () => {
        cleanup(widgetId);
        reject(new Error('turnstile challenge failed'));
      },
    });
    window.turnstile!.execute(widgetId);
  });
}

// Single-slot token pool. Tokens are single-use server-side and expire after
// ~5 minutes; keep one pre-minted so a vote never waits on the challenge.
const TOKEN_MAX_AGE_MS = 4 * 60_000; // refresh margin under the ~5 min expiry
let pooled: Promise<string> | null = null;
let pooledAt = 0;

/**
 * Start minting a token in the background so the next protected call
 * (vote, submission) doesn't pay the challenge round trip. Safe to call
 * often — a fresh pooled token is kept, not re-minted.
 */
export function prewarmTurnstileToken(): void {
  if (!SITE_KEY) return;
  if (pooled && Date.now() - pooledAt < TOKEN_MAX_AGE_MS) return;
  pooledAt = Date.now();
  const minting = mintToken();
  pooled = minting;
  // Drop a failed mint so the next call retries instead of rejecting.
  minting.catch(() => {
    if (pooled === minting) pooled = null;
  });
}

/**
 * Web: invisible Turnstile challenge token, served from the pre-warmed pool
 * when available (a replacement starts minting immediately). Without a
 * configured sitekey (local dev), returns the dev placeholder that the API
 * accepts when no TURNSTILE_SECRET is set.
 */
export async function getTurnstileToken(): Promise<string> {
  if (!SITE_KEY) return 'dev';
  const fresh =
    pooled && Date.now() - pooledAt < TOKEN_MAX_AGE_MS ? pooled : mintToken();
  pooled = null;
  prewarmTurnstileToken();
  return fresh;
}
