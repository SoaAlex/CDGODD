/** Where an ad unit sits on the screen. `side` is web-only (desktop rails). */
export type AdPlacement = 'banner' | 'side';

export type AdSlotProps = {
  placement?: AdPlacement;
};

/**
 * H5 Games Ads placements the game uses: `start` before play begins or
 * restarts, `next` between batches of cards or rounds.
 */
export type RequestAdBreak = (type: 'start' | 'next', name: string) => void;
