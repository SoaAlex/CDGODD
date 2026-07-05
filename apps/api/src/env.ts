export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ROOMS: DurableObjectNamespace;
  CDN_BASE: string;
  TURNSTILE_SECRET?: string;
  IP_HASH_SALT?: string;
  ADMIN_TOKEN?: string;
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
