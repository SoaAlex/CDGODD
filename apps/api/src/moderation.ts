/**
 * Proactive moderation for user submissions.
 * Layer 1: blocklist (fast, free). Layer 2 (M3): moderation model call.
 * Nothing goes live without admin approval regardless (items.status).
 */

// Minimal starter blocklist; extend in M3 (and per language).
const BLOCKLIST: RegExp[] = [
  /\bhitler\b/i,
  /\bnazi\b/i,
  /\bnègre\b/i,
  /\bpédophil/i,
];

export function isBlocked(label: string): boolean {
  return BLOCKLIST.some((re) => re.test(label));
}

/** Auto-hide threshold: items with this many reports get pulled pending review. */
export const REPORT_AUTO_HIDE_THRESHOLD = 5;
