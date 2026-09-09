import { eq, and, sql } from "drizzle-orm";
import { db, menuItemsTable, promoCodesTable, restaurantsTable } from "@workspace/db";
import type { MenuItem } from "@workspace/db";

/**
 * The single place order money is worked out.
 *
 * Everything here is derived from the menu, coupon and restaurant tables. Nothing a
 * client sends about price is used. The order route previously took `unitPrice`,
 * add-on prices, `discountAmount` and even `finalTotal` from the request body, so a
 * guest could pay whatever they typed — and a large enough discount pushed the total
 * below zero.
 *
 * Tax was also hardcoded at 5% in several files with three different roundings, so the
 * same basket produced different bills on different screens. Rate and rounding now
 * live here so every caller agrees.
 */

/** Money is rounded once, at the end of each step, to avoid drifting sub-paisa errors. */
export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

type VariantRow = { name?: string; price?: unknown };
type AddonRow = { name?: string; price?: unknown };

export type PricedItem = {
  unitPrice: number;
  variant: string | null;
  addons: { name: string; price: number }[];
};

/**
 * Work out what one line of the order really costs.
 *
 * The client may say *which* variant and *which* add-ons it wants — that is a choice.
 * It may not say what they cost: those prices come from the item's own `variants` and
 * `addons` columns, and anything the client names that the dish does not actually
 * offer is dropped rather than charged.
 */
export function priceMenuItem(item: MenuItem, requested: Record<string, unknown>): PricedItem {
  const base = toNumber(item.discountedPrice ?? item.price);

  let unitPrice = base;
  let variantName: string | null = null;
  const wantedVariant = typeof requested.variant === "string" ? requested.variant.trim() : "";
  if (wantedVariant) {
    const variants = Array.isArray(item.variants) ? (item.variants as (VariantRow | string)[]) : [];
    // A dish's `variants` column holds either priced rows ({name, price}) or, for menus
    // that never set per-size prices, plain strings like ["Half", "Full"]. Only the
    // object shape was matched, so a plain-string menu dropped the guest's choice
    // entirely: the order line said `variant: null` and the kitchen made a full plate
    // for someone who asked for a half. The name is recorded either way; the price only
    // moves when the menu actually carries one for that size.
    const match = variants.find(v =>
      (typeof v === "string" ? v : String(v?.name ?? "")).trim() === wantedVariant);
    if (match !== undefined) {
      variantName = typeof match === "string" ? match : String(match.name);
      if (typeof match !== "string" && match.price != null && toNumber(match.price) > 0) {
        // A priced variant row carries the full price of that size, not a surcharge.
        unitPrice = toNumber(match.price);
      }
    }
  }

  const offered = Array.isArray(item.addons) ? (item.addons as AddonRow[]) : [];
  const wanted = Array.isArray(requested.addons) ? (requested.addons as AddonRow[]) : [];
  const addons: { name: string; price: number }[] = [];
  for (const a of wanted) {
    const name = String(a?.name ?? "").trim();
    if (!name) continue;
    const match = offered.find(o => String(o?.name ?? "").trim() === name);
    if (!match) continue; // not on this dish — silently dropped, never charged
    const price = round2(toNumber(match.price));
    addons.push({ name, price });
    unitPrice += price;
  }

  return { unitPrice: round2(unitPrice), variant: variantName, addons };
}

/**
 * The restaurant's own GST rate, as a fraction. Falls back to 5% — the rate the code
 * hardcoded everywhere before — so behaviour is unchanged for a venue that has not
 * configured one yet.
 */
export async function taxRateFor(restaurantId: number): Promise<number> {
  const [restaurant] = await db
    .select({ settings: restaurantsTable.settings })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);

  const settings = (restaurant?.settings ?? {}) as Record<string, unknown>;
  const billing = (settings.billing ?? {}) as Record<string, unknown>;
  const percent = toNumber(billing.taxPercent);
  if (percent > 0 && percent <= 40) return percent / 100;
  return 0.05;
}

/**
 * The tax treatments a menu line can carry, and the rate each attracts at this venue.
 *
 * `liquorConfigured` says whether the venue has actually set a rate for alcohol. Alcohol
 * sits outside GST in India — it carries state excise and VAT instead — and the rate varies
 * by state, so there is no honest default. Until a venue sets one, liquor is billed at 0%
 * rather than swept into GST: under-charging is a commercial decision the venue can correct,
 * whereas collecting 5% GST on a non-GST supply makes the tax invoice a false document.
 */
export type VenueTaxRates = { food: number; liquor: number; liquorConfigured: boolean };

export async function taxRatesFor(restaurantId: number): Promise<VenueTaxRates> {
  const [restaurant] = await db
    .select({ settings: restaurantsTable.settings })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);

  const settings = (restaurant?.settings ?? {}) as Record<string, unknown>;
  const billing = (settings.billing ?? {}) as Record<string, unknown>;
  const foodPercent = toNumber(billing.taxPercent);
  const food = foodPercent > 0 && foodPercent <= 40 ? foodPercent / 100 : 0.05;

  const liquorPercent = toNumber(billing.liquorTaxPercent);
  const liquorConfigured = liquorPercent > 0 && liquorPercent <= 100;
  return { food, liquor: liquorConfigured ? liquorPercent / 100 : 0, liquorConfigured };
}

/**
 * Split GST into its two halves.
 *
 * Each half is worked out from the taxable value at half the rate, which is what the law
 * requires and which makes them equal by construction. The old code halved an already
 * rounded total — `cgst = round(totalGst / 2)`, `sgst = totalGst - cgst` — so any bill whose
 * GST landed on an odd number of paise came out as e.g. CGST 1.63 / SGST 1.62. That is about
 * half of all bills, and each one is malformed.
 */
export function splitGst(taxableAmount: number, rate: number): { cgst: number; sgst: number; totalGst: number } {
  const half = round2(Math.max(0, taxableAmount) * (rate / 2));
  return { cgst: half, sgst: half, totalGst: round2(half * 2) };
}

export type TaxableLine = { amount: number; taxCategory?: string | null };

/**
 * Work out the tax on a basket, one bucket per treatment.
 *
 * A discount comes off the whole basket, so it is apportioned across the buckets in
 * proportion to what each contributes — otherwise a discount on a food-and-drinks bill
 * would relieve tax on the wrong supply.
 */
export function computeBasketTax(lines: TaxableLine[], rates: VenueTaxRates, discount = 0) {
  const bucketOf = (l: TaxableLine) => {
    const c = String(l.taxCategory ?? "food").toLowerCase();
    return c === "liquor" || c === "alcohol" ? "liquor" : c === "exempt" ? "exempt" : "food";
  };
  const gross = { food: 0, liquor: 0, exempt: 0 };
  for (const l of lines) gross[bucketOf(l) as keyof typeof gross] += Math.max(0, l.amount);

  const subtotal = round2(gross.food + gross.liquor + gross.exempt);
  const relief = Math.min(Math.max(0, discount), subtotal);
  const share = (v: number) => (subtotal > 0 ? round2(Math.max(0, v - relief * (v / subtotal))) : 0);

  const foodTaxable = share(gross.food);
  const liquorTaxable = share(gross.liquor);
  const exemptTaxable = share(gross.exempt);

  const gst = splitGst(foodTaxable, rates.food);
  const liquorTax = round2(liquorTaxable * rates.liquor);

  return {
    subtotal,
    discount: round2(relief),
    foodTaxable,
    liquorTaxable,
    exemptTaxable,
    cgst: gst.cgst,
    sgst: gst.sgst,
    gst: gst.totalGst,
    liquorTax,
    liquorRatePercent: round2(rates.liquor * 100),
    liquorTaxConfigured: rates.liquorConfigured,
    /** Everything the guest pays in tax, which is what the order row stores. */
    tax: round2(gst.totalGst + liquorTax),
  };
}

/**
 * Tax on an order's own lines.
 *
 * Split, merge, reorder and void/comp each re-taxed the basket with their own
 * `round2(taxable * rate)`, which is not the same number as the CGST + SGST the order was
 * priced with: rounding each half independently can differ from rounding the whole by a
 * paisa. So splitting a bill and merging it straight back handed a total a paisa away from
 * where it started. They also all assumed one rate for everything, so splitting a table's
 * bill quietly re-taxed the whisky at the food rate. Every path now goes through here.
 */
export async function taxForOrderItems(
  restaurantId: number,
  items: { subtotal?: unknown; price?: unknown; quantity?: unknown; taxCategory?: string | null }[],
  discount = 0,
) {
  const lines = items.map(i => ({
    amount: toNumber(i.subtotal ?? (toNumber(i.price) * (toNumber(i.quantity) || 1))),
    taxCategory: i.taxCategory ?? "food",
  }));
  return computeBasketTax(lines, await taxRatesFor(restaurantId), discount);
}

/**
 * Resolve a coupon code against the promo table. An unknown, expired, inactive or
 * unmet code yields no discount rather than an error — the guest still gets their
 * order, just at full price, which is what a counter would do.
 *
 * It also says *why* it gave nothing. A code that silently comes off the bill leaves a
 * guest looking at the full price with no idea whether they mistyped it, whether it had
 * run out, or whether the app is broken; a counter would tell them.
 */
export async function resolveDiscount(
  restaurantId: number,
  couponCode: unknown,
  subtotal: number,
): Promise<{ discount: number; appliedCoupon: string | null; promoId?: number; reason?: string }> {
  const code = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : "";
  if (!code) return { discount: 0, appliedCoupon: null };

  const [promo] = await db
    .select()
    .from(promoCodesTable)
    .where(and(eq(promoCodesTable.restaurantId, restaurantId), eq(promoCodesTable.code, code)))
    .limit(1);

  if (!promo) return { discount: 0, appliedCoupon: null, reason: `"${code}" is not a code at this restaurant.` };
  if (promo.isActive === false) {
    return { discount: 0, appliedCoupon: null, reason: `"${code}" is no longer being offered.` };
  }

  // Expiry and usage limit were both ignored before, so a spent or long-dead code
  // still took money off the bill.
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { discount: 0, appliedCoupon: null, reason: `"${code}" expired on ${new Date(promo.expiresAt).toLocaleDateString("en-IN")}.` };
  }

  const usageLimit = Number(promo.usageLimit ?? 0);
  const usedCount = Number(promo.usedCount ?? 0);
  if (usageLimit > 0 && usedCount >= usageLimit) {
    return { discount: 0, appliedCoupon: null, reason: `"${code}" has already been fully used.` };
  }

  const minOrder = toNumber(promo.minOrderAmount);
  if (minOrder > 0 && subtotal < minOrder) {
    return { discount: 0, appliedCoupon: null, reason: `"${code}" needs an order of at least ₹${minOrder.toFixed(2)}.` };
  }

  const value = toNumber(promo.discountValue);
  const type = String(promo.discountType).toLowerCase();
  let discount = type === "percent" || type === "percentage"
    ? (subtotal * value) / 100
    : value;

  const maxDiscount = toNumber(promo.maxDiscount);
  if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);

  // Never more than the basket itself — a discount can reduce a bill to zero, never below.
  discount = Math.min(Math.max(discount, 0), subtotal);
  return { discount: round2(discount), appliedCoupon: code, promoId: promo.id };
}

/**
 * Count a redemption, once the order it discounted actually exists.
 *
 * `usage_limit` was checked against a counter nothing ever advanced, so a code limited
 * to one use could be used for ever. The increment is conditional on the limit inside
 * the same statement, so two guests redeeming the last use at the same moment cannot
 * both get it.
 */
export async function redeemCoupon(promoId: number | undefined): Promise<void> {
  if (!promoId) return;
  try {
    await db
      .update(promoCodesTable)
      .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
      .where(and(
        eq(promoCodesTable.id, promoId),
        sql`(${promoCodesTable.usageLimit} is null or ${promoCodesTable.usageLimit} <= 0 or ${promoCodesTable.usedCount} < ${promoCodesTable.usageLimit})`,
      ));
  } catch {
    // Counting a redemption must never be the thing that fails an order.
  }
}

/**
 * A tip is the guest's choice, but it is still validated: never negative, and capped
 * at the value of the order so a mistyped figure cannot create an absurd bill.
 */
export function clampTip(tipAmount: unknown, orderValue: number): number {
  const tip = toNumber(tipAmount);
  if (tip <= 0) return 0;
  return round2(Math.min(tip, Math.max(orderValue, 0)));
}
