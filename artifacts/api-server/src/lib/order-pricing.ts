import { eq, and } from "drizzle-orm";
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
    const variants = Array.isArray(item.variants) ? (item.variants as VariantRow[]) : [];
    const match = variants.find(v => String(v?.name ?? "").trim() === wantedVariant);
    if (match) {
      variantName = String(match.name);
      // A variant row may hold either the full price of that size or an amount to add.
      // Treating it as the full price when it is present keeps half/full pricing honest.
      unitPrice = toNumber(match.price);
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
 * Resolve a coupon code against the promo table. An unknown, expired, inactive or
 * unmet code yields no discount rather than an error — the guest still gets their
 * order, just at full price, which is what a counter would do.
 */
export async function resolveDiscount(
  restaurantId: number,
  couponCode: unknown,
  subtotal: number,
): Promise<{ discount: number; appliedCoupon: string | null }> {
  const code = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : "";
  if (!code) return { discount: 0, appliedCoupon: null };

  const [promo] = await db
    .select()
    .from(promoCodesTable)
    .where(and(eq(promoCodesTable.restaurantId, restaurantId), eq(promoCodesTable.code, code)))
    .limit(1);

  if (!promo || promo.isActive === false) return { discount: 0, appliedCoupon: null };

  // Expiry and usage limit were both ignored before, so a spent or long-dead code
  // still took money off the bill.
  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return { discount: 0, appliedCoupon: null };
  }

  const usageLimit = Number(promo.usageLimit ?? 0);
  const usedCount = Number(promo.usedCount ?? 0);
  if (usageLimit > 0 && usedCount >= usageLimit) return { discount: 0, appliedCoupon: null };

  const minOrder = toNumber(promo.minOrderAmount);
  if (minOrder > 0 && subtotal < minOrder) return { discount: 0, appliedCoupon: null };

  const value = toNumber(promo.discountValue);
  const type = String(promo.discountType).toLowerCase();
  let discount = type === "percent" || type === "percentage"
    ? (subtotal * value) / 100
    : value;

  const maxDiscount = toNumber(promo.maxDiscount);
  if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);

  // Never more than the basket itself — a discount can reduce a bill to zero, never below.
  discount = Math.min(Math.max(discount, 0), subtotal);
  return { discount: round2(discount), appliedCoupon: code };
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
