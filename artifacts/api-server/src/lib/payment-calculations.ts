/** Shared Super Admin payment / commission math */

export type OrderLike = {
  subtotal?: string | number | null;
  total?: string | number | null;
  tax?: string | number | null;
  paymentStatus?: string | null;
  status?: string | null;
};

export function parseMoney(value: unknown): number {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Commission is calculated on subtotal (pre-tax); falls back to total. */
export function orderCommissionBase(order: OrderLike): number {
  const subtotal = parseMoney(order.subtotal);
  if (subtotal > 0) return subtotal;
  return parseMoney(order.total);
}

export function orderGrossTotal(order: OrderLike): number {
  return parseMoney(order.total);
}

/**
 * Counts toward revenue / settlements only once the money is actually in —
 * cash basis, as the owner asked for. An order the kitchen accepted, or even
 * delivered, is not revenue until someone collects for it; it starts counting
 * the moment a waiter (in the app) or the panel marks it paid.
 *
 * Before this, any in-flight order counted, so the dashboard showed money that
 * had never been collected.
 */
export function isPaidOrder(order: OrderLike): boolean {
  const ps = String(order.paymentStatus ?? "").toLowerCase();
  // A cancelled (voided) order is never revenue — even if it was marked paid before it was
  // cancelled (e.g. a UPI order auto-marks paid, then gets cancelled). Check this FIRST so a
  // stale paymentStatus="paid" can't slip a cancelled order into revenue totals.
  if (String(order.status ?? "").toLowerCase() === "cancelled") return false;
  if (ps === "refunded" || ps === "failed") return false;
  return ps === "paid" || ps === "success";
}

export function isRefundedOrder(order: OrderLike): boolean {
  const ps = String(order.paymentStatus ?? "").toLowerCase();
  const st = String(order.status ?? "").toLowerCase();
  return ps === "refunded" || st === "cancelled";
}

export function calcCommissionAmount(order: OrderLike, ratePercent: number): number {
  if (!isPaidOrder(order) || isRefundedOrder(order)) return 0;
  return roundMoney(orderCommissionBase(order) * (ratePercent / 100));
}

export function calcNetPayout(
  gross: number,
  commission: number,
  refunds = 0,
  penalties = 0,
): number {
  return roundMoney(Math.max(0, gross - commission - refunds - penalties));
}

export function sumOrderTotals(orders: OrderLike[]): number {
  return roundMoney(orders.filter(isPaidOrder).reduce((s, o) => s + orderGrossTotal(o), 0));
}

export function sumOrderCommissions(orders: OrderLike[], ratePercent: number): number {
  return roundMoney(
    orders.filter(isPaidOrder).reduce((s, o) => s + calcCommissionAmount(o, ratePercent), 0),
  );
}
