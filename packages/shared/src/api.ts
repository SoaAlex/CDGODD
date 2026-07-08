import type {
  DeckCard,
  RoomCardResult,
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
  /** Host only, from the results phase: deal fresh cards and replay. */
  | { type: 'restart' };

/** WebSocket messages: room -> client */
export type RoomServerMessage =
  | { type: 'state'; room: RoomState }
  /** The full round dealt at start; players swipe it at their own pace. */
  | { type: 'deck'; cards: DeckCard[] }
  /** Live mode only: running tally of a card the voter just voted on. */
  | { type: 'tally'; cardIndex: number; votesLeft: number; votesRight: number }
  | { type: 'reveal'; results: RoomCardResult[] }
  | { type: 'error'; message: string };

export interface ApiError {
  error: string;
}
