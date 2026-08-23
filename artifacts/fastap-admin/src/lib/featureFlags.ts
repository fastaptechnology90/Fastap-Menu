/**
 * Feature flags for work-in-progress modules.
 *
 * New / half-finished features stay HIDDEN in production (Railway) builds so a live
 * deploy never exposes something that isn't fully working yet. They turn ON
 * automatically in local dev (`vite dev`), where we build and test them.
 *
 * When a module is finished, either remove its flag here or set the matching
 * `VITE_FEATURE_*` env var to "1" (or "true") on the production host to switch it on.
 *
 * NOTE: keep the `import.meta.env.VITE_FEATURE_*` reads as literal member access —
 * Vite only statically replaces literal `import.meta.env.X`, not dynamic keys.
 */
const enabled = (envValue: string | boolean | undefined): boolean =>
  Boolean(import.meta.env.DEV) || envValue === "1" || envValue === "true" || envValue === true;

export const FEATURES = {
  /** Hotel reception: check-in, room rate/discount, folio, bar/spa → room bill (WIP). */
  hotelReception: enabled(import.meta.env.VITE_FEATURE_HOTEL_RECEPTION),
  /** Guest pre-order / order-ahead with a scheduled arrival time (WIP). */
  preOrder: enabled(import.meta.env.VITE_FEATURE_PRE_ORDER),
  /** Simulate incoming Swiggy/Zomato & OTA orders until partner APIs are wired (WIP). */
  aggregatorIngest: enabled(import.meta.env.VITE_FEATURE_AGGREGATOR_INGEST),
};

export type FeatureName = keyof typeof FEATURES;
