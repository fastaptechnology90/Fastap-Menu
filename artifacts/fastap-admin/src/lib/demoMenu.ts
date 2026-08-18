/** Offline demo menu — re-exports full digital menu catalog */
export { getDemoMenu } from "./digitalMenu";

export const DEMO_RESTAURANT = {
  name: "Spice Garden",
  slug: "spice-garden",
  table: "T-12",
};

export type DemoMenuResponse = ReturnType<typeof import("./digitalMenu").getDemoMenu>;
