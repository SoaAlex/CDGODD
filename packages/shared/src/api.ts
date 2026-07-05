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
  status: 'pending' | 'rejected';
  itemId?: number;
}

/** POST /rooms */
export interface CreateRoomResponse {
  room: RoomState;
}

/** WebSocket messages: client -> room */
export type RoomClientMessage =
  | { type: 'join'; sessionId: string }
  | { type: 'start' }
  | { type: 'vote'; cardIndex: number; side: Side };

/** WebSocket messages: room -> client */
export type RoomServerMessage =
  | { type: 'state'; room: RoomState }
  | { type: 'card'; cardIndex: number; card: DeckCard }
  /** Live mode only: result of a card everyone just voted on. */
  | { type: 'tally'; cardIndex: number; votesLeft: number; votesRight: number }
  | { type: 'reveal'; results: RoomCardResult[] }
  | { type: 'error'; message: string };

export interface ApiError {
  error: string;
}
