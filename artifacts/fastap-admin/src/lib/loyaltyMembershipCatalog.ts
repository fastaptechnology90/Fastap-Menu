/**
 * Loyalty — the tier ids, and nothing the venue has not agreed to.
 *
 * This file used to hold the whole scheme as constants: five tiers with cashback rates,
 * a perk list against each ("Private dining", "Personal chef", "Chef's table access",
 * "Concierge service", "Dedicated manager", "Complimentary stays", "VIP seating", "Free
 * delivery"), five reward types, fixed birthday and anniversary values, and a demo
 * member holding 1,240 points. `/user/loyalty` rendered the perks to the guest as
 * promises from the venue they were sitting in. Nothing in the product delivers any of
 * them, no route writes them, and no owner ever set them.
 *
 * The ladder now comes from `GET /public/me/loyalty`, which returns `tiers` as id,
 * label, `minPoints` and `cashbackPercent` — the three facts the product can honour —
 * along with the guest's own points, progress and reward balances.
 *
 * `POINTS_REDEEM_RATE` stays only as the fallback for the redemption hint before the
 * first response arrives; the live value is `rewards.points.redeemRate`.
 */

export type MembershipTierId = "silver" | "gold" | "platinum" | "diamond" | "vip-elite";

/** 10 points = ₹1 of dining credit. Overridden by the server's own rate once loaded. */
export const POINTS_REDEEM_RATE = 10;
