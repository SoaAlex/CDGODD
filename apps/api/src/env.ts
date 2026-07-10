export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ROOMS: DurableObjectNamespace;
  AI: Ai;
  CDN_BASE: string;
  TURNSTILE_SECRET?: string;
  IP_HASH_SALT?: string;
  ADMIN_TOKEN?: string;
  PIXABAY_KEY?: string;
  /** Workers rate-limit binding (prod only; absent in tests/local dev). */
  VOTE_LIMITER?: RateLimit;
}

export type AppContext = {
  Bindings: Env;
  Variables: {
    /** Anonymous device session id (validated UUID) or null. */
    sessionId: string | null;
    /** Salted hash of client IP. Raw IP is never stored. */
    ipHash: string;
  };
};
