/**
 * Native: Turnstile has no official mobile SDK. The standard approach is a
 * hidden WebView rendering the widget; until that lands, native builds send
 * the dev placeholder and the API relies on IP rate limiting + session
 * dedupe (Turnstile verification is enforced server-side only when
 * TURNSTILE_SECRET is configured).
 */
export function getTurnstileToken(): Promise<string> {
  return Promise.resolve('dev');
}
