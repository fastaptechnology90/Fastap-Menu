export type WalletTypeId = "main" | "cashback" | "refund" | "reward" | "gift" | "membership";

export const WALLET_TYPES = [
  { id: "main" as const, label: "Recharge Wallet", icon: "💳", desc: "Add money via UPI, card or net banking", color: "emerald", rechargeable: true },
  { id: "cashback" as const, label: "Cashback Wallet", icon: "💰", desc: "Earned cashback from orders & campaigns", color: "amber", rechargeable: false },
  { id: "refund" as const, label: "Refund Wallet", icon: "↩️", desc: "Order refunds & cancellations", color: "blue", rechargeable: false },
  { id: "reward" as const, label: "Reward Wallet", icon: "🎁", desc: "Loyalty points converted to wallet credit", color: "violet", rechargeable: false },
  { id: "gift" as const, label: "Gift Wallet", icon: "🎀", desc: "Gift cards & vouchers received", color: "pink", rechargeable: false },
  { id: "membership" as const, label: "Membership Wallet", icon: "👑", desc: "VIP membership credits & benefits", color: "orange", rechargeable: false },
];

export const RECHARGE_PRESETS = [100, 200, 500, 1000, 2000];

export const TRANSFER_RULES: Record<WalletTypeId, WalletTypeId[]> = {
  main: ["cashback", "reward", "gift", "membership"],
  cashback: ["main"],
  refund: ["main"],
  reward: ["main", "gift"],
  gift: ["main"],
  membership: ["main"],
};

export const DEMO_WALLET_BALANCES: Record<WalletTypeId, number> = {
  main: 850,
  cashback: 120,
  refund: 250,
  reward: 180,
  gift: 500,
  membership: 1000,
};

export const DEMO_TRANSACTIONS = [
  { id: 1, type: "recharge", walletType: "main", amount: 500, description: "Wallet recharge via UPI", createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 2, type: "cashback", walletType: "cashback", amount: 45, description: "5% cashback — Order #1234", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 3, type: "payment", walletType: "main", amount: -320, description: "Payment — Spice Garden", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 4, type: "refund", walletType: "refund", amount: 250, description: "Refund — Cancelled order #1220", createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 5, type: "reward_redeem", walletType: "reward", amount: 200, description: "Points redeemed — 2000 pts", createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: 6, type: "gift_credit", walletType: "gift", amount: 500, description: "Gift card — BDAY2026", createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 7, type: "membership_credit", walletType: "membership", amount: 1000, description: "Gold membership welcome credit", createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
  { id: 8, type: "transfer", walletType: "main", amount: 100, description: "Transfer from Cashback wallet", createdAt: new Date(Date.now() - 6 * 86400000).toISOString(), metadata: { from: "cashback", to: "main" } },
];

export const DEMO_CASHBACK_SUMMARY = {
  totalEarned: 680,
  totalUsed: 560,
  pendingCashback: 45,
  thisMonthEarned: 120,
  lastCashbackAt: new Date(Date.now() - 86400000).toISOString(),
  recentEarned: [
    { orderId: "ORD-1234", amount: 45, percent: 5, date: new Date(Date.now() - 86400000).toISOString() },
    { orderId: "ORD-1230", amount: 38, percent: 5, date: new Date(Date.now() - 3 * 86400000).toISOString() },
    { orderId: "ORD-1225", amount: 37, percent: 5, date: new Date(Date.now() - 5 * 86400000).toISOString() },
  ],
};

export function walletTypeLabel(id: WalletTypeId): string {
  return WALLET_TYPES.find(w => w.id === id)?.label ?? id;
}

export function canTransfer(from: WalletTypeId, to: WalletTypeId): boolean {
  return TRANSFER_RULES[from]?.includes(to) ?? false;
}

export function totalBalance(balances: Record<WalletTypeId, number>): number {
  return Object.values(balances).reduce((s, v) => s + v, 0);
}
