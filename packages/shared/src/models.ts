/** Political side a card can be swiped to. */
export type Side = 'left' | 'right';

export type ItemStatus = 'pending' | 'approved' | 'rejected';

/** An item as stored in the DB (aggregate counters included). */
export interface Item {
  id: number;
  categoryId: number | null;
  imageKey: string | null;
  votesLeft: number;
  votesRight: number;
  reportCount: number;
  status: ItemStatus;
  submittedBy: string | null;
  createdAt: number; // epoch ms
}

/** An item as served to the game client: localized label + resolved image URL. */
export interface DeckCard {
  id: number;
  label: string;
  categoryKey: string | null;
  imageUrl: string | null;
}

export interface VoteTally {
  itemId: number;
  votesLeft: number;
  votesRight: number;
}

export interface Category {
  id: number;
  key: string;
}

/** Multiplayer room modes. */
export type RoomMode = 'batch' | 'live';

export type RoomPhase = 'lobby' | 'playing' | 'results';

export interface RoomState {
  code: string;
  mode: RoomMode;
  phase: RoomPhase;
  /** Number of cards in the round. */
  roundSize: number;
  playerCount: number;
  currentCardIndex: number;
  /** Session id of the room creator (only the host can start the round). */
  hostId: string | null;
}

/** Per-card outcome revealed at the end of a round. */
export interface RoomCardResult {
  card: DeckCard;
  votesLeft: number;
  votesRight: number;
}
