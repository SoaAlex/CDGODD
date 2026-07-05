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

/**
 * Web: invisible Turnstile challenge — a fresh token per protected call
 * (they're single-use server-side). Without a configured sitekey (local
 * dev), returns the dev placeholder that the API accepts when no
 * TURNSTILE_SECRET is set.
 */
export async function getTurnstileToken(): Promise<string> {
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
