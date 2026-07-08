/** Where an ad unit sits on the screen. `side` is web-only (desktop rails). */
export type AdPlacement = 'banner' | 'side';

export type AdSlotProps = {
  placement?: AdPlacement;
};
