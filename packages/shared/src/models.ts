/** Political side a card can be swiped to. */
export type Side = 'left' | 'right';

export type ItemStatus = 'pending' | 'approved' | 'rejected';

/** An item as stored in the DB (aggregate counters included). */
export interface Item {
  id: number;
  /** Keys of the categories the item belongs to (item_categories join). */
  categoryIds: number[];
  imageKey: string | null;
  votesLeft: number;
  votesRight: number;
  reportCount: number;
  status: ItemStatus;
  submittedBy: string | null;
  createdAt: number; // epoch ms
}

/** Credit for a card image sourced from a free-license provider or AI. */
export interface ImageAttribution {
  author: string | null;
  /** Short license name; 'ai-generated' for AI images. */
  license: string;
  /** Source page (Commons file page / Pixabay page), linked from credit. */
  sourceUrl: string | null;
}

/** An item as served to the game client: localized label + resolved image URL. */
export interface DeckCard {
  id: number;
  label: string;
  /** Empty array when the item has no category. */
  categoryKeys: string[];
  imageUrl: string | null;
  /** Null/absent when the image needs no credit (manual upload, legacy). */
  imageAttribution?: ImageAttribution | null;
  /**
   * Global tally at deck-fetch time. Lets the client show the previous
   * card's result instantly (own vote added optimistically) instead of
   * waiting for the vote round trip; reconciled by the vote response.
   */
  votesLeft: number;
  votesRight: number;
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

/** A connected player as seen by everyone in the room (ephemeral, in-memory). */
export interface RoomPlayer {
  id: string;
  name: string;
}

export interface RoomState {
  code: string;
  mode: RoomMode;
  phase: RoomPhase;
  /** Number of cards in the round. */
  roundSize: number;
  /** Category filter the round was dealt from; empty = all categories. */
  categoryKeys: string[];
  /** 'all' = cards belong to every category in the filter; default 'any'. */
  categoryMatch: 'any' | 'all';
  /** Categories excluded from the deal; items in any of them are dropped. */
  excludeKeys: string[];
  playerCount: number;
  /** Currently connected players with their chosen nicknames. */
  players: RoomPlayer[];
  currentCardIndex: number;
  /**
   * Results phase: index of the card currently revealed (host-paced, batch
   * mode). Equals roundSize once the reveal is over — or always, in live
   * mode, which skips straight to the summary.
   */
  revealIndex: number;
  /** Session id of the room creator (only the host can start the round). */
  hostId: string | null;
}

/** Per-card outcome revealed at the end of a round. */
export interface RoomCardResult {
  card: DeckCard;
  votesLeft: number;
  votesRight: number;
  /** Nicknames of who voted each side (ephemeral, display only). */
  votersLeft: string[];
  votersRight: string[];
}
