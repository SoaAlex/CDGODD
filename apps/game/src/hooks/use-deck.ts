import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeckCard, Side, VoteTally } from '@cdgodd/shared';
import { castVote, fetchDeck } from '@/lib/api';
import { recordVote } from '@/lib/history';
import { clearSeen, getSeen, markSeen } from '@/lib/seen';
import { prewarmTurnstileToken } from '@/lib/turnstile';

/** Refetch a new batch when this few cards remain. */
const REFILL_THRESHOLD = 5;
/** How many upcoming card images to prefetch. */
const PREFETCH_AHEAD = 5;

/**
 * A fresh shuffle seed for the deck order. Stays fixed for one session's
 * pagination (so keyset paging is consistent) and is regenerated on every
 * deck reset — first load, filter change, replay — so the order differs each
 * time. Range [1, 1e9] matches the server's `seed` bound.
 */
function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}

/** The previous card's vote: what it was, how you voted, how the crowd did. */
export interface LastVote {
  card: DeckCard;
  side: Side;
  /** Optimistic (deck counts + own vote) until the server response replaces it. */
  tally: VoteTally;
}

interface DeckState {
  cards: DeckCard[];
  loading: boolean;
  error: string | null;
  lastVote: LastVote | null;
}

export function useDeck(
  categories: string[] = [],
  matchAll = false,
  excluded: string[] = [],
) {
  const [state, setState] = useState<DeckState>({
    cards: [],
    loading: true,
    error: null,
    lastVote: null,
  });
  const cursor = useRef<number | undefined>(undefined);
  const exhausted = useRef(false);
  // True once a card was skipped as already-seen or swiped this session —
  // distinguishes "you've swiped everything" from "no items match the filter".
  const seenAny = useRef(false);
  const fetching = useRef(false);
  const prefetched = useRef(new Set<string>());
  // Synchronous mirror of state.cards, so swipe() can read/advance the top
  // card outside the setState updater (updaters must stay pure).
  const queue = useRef<DeckCard[]>([]);
  // Bumped when the category filter changes: in-flight fetches from the
  // previous filter are discarded instead of polluting the fresh queue.
  const generation = useRef(0);
  // Per-session shuffle seed; regenerated on every reset (see resets below).
  const seed = useRef(newSeed());
  const refillRef = useRef<() => Promise<void>>(async () => {});

  // Join for a stable dependency; keys are [a-z0-9-] so ',' is safe.
  const categoriesKey = categories.join(',');
  const excludedKey = excluded.join(',');

  const refill = useCallback(async () => {
    if (fetching.current || exhausted.current) return;
    fetching.current = true;
    const gen = generation.current;
    try {
      const wanted = categoriesKey ? categoriesKey.split(',') : [];
      const unwanted = excludedKey ? excludedKey.split(',') : [];
      const seen = await getSeen();
      // Cards already swiped (persisted on-device) are skipped; keep paging
      // until at least one unseen card shows up or the server runs out.
      let batch: DeckCard[] = [];
      let next = cursor.current;
      do {
        const { cards, nextCursor } = await fetchDeck(
          next,
          wanted,
          matchAll,
          seed.current,
          unwanted,
        );
        if (generation.current !== gen) return; // stale filter
        next = nextCursor;
        const unseen = cards.filter((card) => !seen.has(card.id));
        if (unseen.length < cards.length) seenAny.current = true;
        batch = [...batch, ...unseen];
      } while (batch.length === 0 && next !== undefined);
      cursor.current = next;
      if (next === undefined) exhausted.current = true;
      queue.current = [...queue.current, ...batch];
      const snapshot = queue.current;
      setState((s) => ({
        ...s,
        cards: snapshot,
        loading: false,
        error: null,
      }));
    } catch (e) {
      if (generation.current !== gen) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'network error',
      }));
    } finally {
      fetching.current = false;
      // Filter changed while we were fetching: fetch the fresh deck now.
      if (generation.current !== gen) void refillRef.current();
    }
  }, [categoriesKey, excludedKey, matchAll]);
  refillRef.current = refill;

  // Initial load + full reset whenever the category filter changes.
  useEffect(() => {
    generation.current += 1;
    cursor.current = undefined;
    exhausted.current = false;
    seenAny.current = false;
    seed.current = newSeed();
    queue.current = [];
    setState({ cards: [], loading: true, error: null, lastVote: null });
    void refill();
  }, [refill]);

  useEffect(() => {
    // Mint a Turnstile token ahead of the first vote (web prod only);
    // getTurnstileToken re-warms the pool after each use.
    prewarmTurnstileToken();
  }, []);

  // Preload upcoming card images so swiping never waits on the network.
  useEffect(() => {
    for (const card of state.cards.slice(0, PREFETCH_AHEAD)) {
      if (card.imageUrl && !prefetched.current.has(card.imageUrl)) {
        prefetched.current.add(card.imageUrl);
        void Image.prefetch(card.imageUrl);
      }
    }
  }, [state.cards]);

  /** Called when the top card is swiped. Optimistic: card leaves instantly. */
  const swipe = useCallback(
    (side: Side) => {
      const top = queue.current[0];
      if (!top) return;
      queue.current = queue.current.slice(1);
      const snapshot = queue.current;
      setState((s) => ({
        ...s,
        cards: snapshot,
        lastVote: {
          card: top,
          side,
          tally: {
            itemId: top.id,
            votesLeft: top.votesLeft + (side === 'left' ? 1 : 0),
            votesRight: top.votesRight + (side === 'right' ? 1 : 0),
          },
        },
      }));

      void recordVote({
        itemId: top.id,
        side,
        label: top.label,
        imageUrl: top.imageUrl,
        at: Date.now(),
      });
      // Never show this card again on this device (until a replay reset).
      void markSeen(top.id);
      seenAny.current = true;

      castVote(top.id, side)
        .then(({ tally }) =>
          setState((s) =>
            s.lastVote?.card.id === top.id
              ? { ...s, lastVote: { ...s.lastVote, tally } }
              : s,
          ),
        )
        .catch(() => {
          /* vote lost on network error — acceptable for solo mode */
        });

      if (snapshot.length <= REFILL_THRESHOLD) void refill();
    },
    [refill],
  );

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    void refill();
  }, [refill]);

  /** Every card has been seen — wipe the seen set and deal from the top. */
  const restart = useCallback(() => {
    generation.current += 1;
    cursor.current = undefined;
    exhausted.current = false;
    seenAny.current = false;
    seed.current = newSeed();
    queue.current = [];
    setState({ cards: [], loading: true, error: null, lastVote: null });
    void clearSeen().then(() => refill());
  }, [refill]);

  return {
    ...state,
    swipe,
    retry,
    restart,
    exhausted: exhausted.current,
    // Deck ran dry only because seen cards were filtered out.
    allSeen:
      exhausted.current && state.cards.length === 0 && seenAny.current,
  };
}
