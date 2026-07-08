import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeckCard, Side, VoteTally } from '@cdgodd/shared';
import { castVote, fetchDeck } from '@/lib/api';
import { recordVote } from '@/lib/history';
import { prewarmTurnstileToken } from '@/lib/turnstile';

/** Refetch a new batch when this few cards remain. */
const REFILL_THRESHOLD = 5;
/** How many upcoming card images to prefetch. */
const PREFETCH_AHEAD = 5;

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

export function useDeck() {
  const [state, setState] = useState<DeckState>({
    cards: [],
    loading: true,
    error: null,
    lastVote: null,
  });
  const cursor = useRef<number | undefined>(undefined);
  const exhausted = useRef(false);
  const fetching = useRef(false);
  const prefetched = useRef(new Set<string>());
  // Synchronous mirror of state.cards, so swipe() can read/advance the top
  // card outside the setState updater (updaters must stay pure).
  const queue = useRef<DeckCard[]>([]);

  const refill = useCallback(async () => {
    if (fetching.current || exhausted.current) return;
    fetching.current = true;
    try {
      const { cards, nextCursor } = await fetchDeck(cursor.current);
      cursor.current = nextCursor;
      if (nextCursor === undefined) exhausted.current = true;
      queue.current = [...queue.current, ...cards];
      const snapshot = queue.current;
      setState((s) => ({
        ...s,
        cards: snapshot,
        loading: false,
        error: null,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'network error',
      }));
    } finally {
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    void refill();
    // Mint a Turnstile token ahead of the first vote (web prod only);
    // getTurnstileToken re-warms the pool after each use.
    prewarmTurnstileToken();
  }, [refill]);

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

  return { ...state, swipe, retry, exhausted: exhausted.current };
}
