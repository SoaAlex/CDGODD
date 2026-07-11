import type {
  DeckCard,
  RoomCardResult,
  RoomMode,
  RoomState,
  Side,
  VoteTally,
} from './models';

/** GET /deck */
export interface DeckResponse {
  cards: DeckCard[];
  /** Pass back as ?cursor= to get the next batch. Absent when exhausted. */
  nextCursor?: number;
}

/** POST /items/:id/vote */
export interface VoteResponse {
  tally: VoteTally;
}

/** GET /items/search */
export interface SearchResponse {
  results: DeckCard[];
}

/** GET /categories — localized category list with approved-item counts. */
export interface CategoriesResponse {
  categories: { key: string; name: string; count: number }[];
  /** Total approved items (the "all categories" count). */
  total: number;
}

/** POST /submissions */
export interface SubmissionResponse {
  /** 'duplicate' = an item with the same normalized label already exists. */
  status: 'pending' | 'rejected' | 'duplicate';
  itemId?: number;
}

/** POST /rooms */
export interface CreateRoomResponse {
  room: RoomState;
}

/** WebSocket messages: client -> room */
export type RoomClientMessage =
  | { type: 'join'; sessionId: string; name: string }
  | { type: 'start' }
  | { type: 'vote'; cardIndex: number; side: Side }
  /**
   * Host only, while playing: end the round now and reveal the results,
   * without waiting for the remaining players (their missing votes simply
   * don't count).
   */
  | { type: 'finish' }
  /**
   * Host only, batch mode, from the results phase: advance the shared
   * card-by-card reveal to the next card.
   */
  | { type: 'next' }
  /**
   * Host only, from the results phase: deal fresh cards and replay.
   * New settings are optional; omitted fields keep the room's current ones.
   */
  | {
      type: 'restart';
      mode?: RoomMode;
      roundSize?: number;
      categoryKeys?: string[];
      categoryMatch?: 'any' | 'all';
      excludeKeys?: string[];
    };

/** WebSocket messages: room -> client */
export type RoomServerMessage =
  | { type: 'state'; room: RoomState }
  /**
   * The full round dealt at start; players swipe it at their own pace.
   * `myVotes` replays the receiving player's own votes (index-aligned with
   * `cards`, null = not voted yet) so a rejoining player resumes where they
   * left off instead of re-swiping the whole deck.
   */
  | { type: 'deck'; cards: DeckCard[]; myVotes: (Side | null)[] }
  /** Live mode only: running tally of a card the voter just voted on. */
  | { type: 'tally'; cardIndex: number; votesLeft: number; votesRight: number }
  | { type: 'reveal'; results: RoomCardResult[] }
  | { type: 'error'; message: string };

export interface ApiError {
  error: string;
}
