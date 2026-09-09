/**
 * Bar & Nightlife — the vocabulary a cocktail is described in, and nothing more.
 *
 * This file used to hold a whole bar: a happy hour ("Mon – Fri 16:00 – 19:00, 20% off"),
 * six base spirits with prices, four named DJ nights ("DJ Aakash", "DJ Nina", ₹500
 * cover), five bar tables in a "Sunset Lounge", three lounges with ₹2,000–₹15,000
 * minimum spends and deposits, a list of sittings, and five discounted happy-hour items.
 * `/user/bar` rendered all of it for every venue as that venue's own programme, and no
 * route anywhere writes any of it — so a restaurant with no bar at all appeared to run
 * Friday DJ nights and a skybox.
 *
 * All of it now comes from `GET /public/bar/catalog/:restaurantId`, which returns the
 * venue's own programme or `configured: false` with a notice.
 *
 * What is left is the way a guest describes a drink they want made — "soda water",
 * "double shot", "lime wheel". That is bar vocabulary, not a claim about a venue, and it
 * carries no prices: the bar prices a custom mix when it makes it.
 */

export const COCKTAIL_MIXERS = [
  { id: "soda", label: "Soda Water" },
  { id: "tonic", label: "Tonic" },
  { id: "cola", label: "Cola" },
  { id: "cranberry", label: "Cranberry" },
  { id: "pineapple", label: "Pineapple Juice" },
  { id: "lime", label: "Fresh Lime" },
] as const;

export const COCKTAIL_GARNISHES = [
  { id: "mint", label: "Fresh Mint" },
  { id: "lime_wheel", label: "Lime Wheel" },
  { id: "orange_peel", label: "Orange Peel" },
  { id: "cherry", label: "Maraschino Cherry" },
  { id: "salt_rim", label: "Salt Rim" },
  { id: "spicy_rim", label: "Spicy Rim" },
] as const;

export const COCKTAIL_STYLES = [
  { id: "regular", label: "Regular" },
  { id: "strong", label: "Double Shot" },
  { id: "light", label: "Light" },
] as const;
