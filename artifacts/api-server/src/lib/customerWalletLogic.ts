export type WalletTypeId = "main" | "cashback" | "refund" | "reward" | "gift" | "membership";

export const WALLET_TYPE_IDS: WalletTypeId[] = ["main", "cashback", "refund", "reward", "gift", "membership"];

export const TRANSFER_RULES: Record<WalletTypeId, WalletTypeId[]> = {
  main: ["cashback", "reward", "gift", "membership"],
  cashback: ["main"],
  refund: ["main"],
  reward: ["main", "gift"],
  gift: ["main"],
  membership: ["main"],
};

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

export function normalizeBuckets(guest: {
  walletBalance?: string | null;
  cashbackBalance?: string | null;
  walletBuckets?: Record<string, string> | null;
}): Record<WalletTypeId, number> {
  const raw = guest.walletBuckets ?? {};
  return {
    main: parseNum(raw.main ?? guest.walletBalance),
    cashback: parseNum(raw.cashback ?? guest.cashbackBalance),
    refund: parseNum(raw.refund),
    reward: parseNum(raw.reward),
    gift: parseNum(raw.gift),
    membership: parseNum(raw.membership),
  };
}

export function bucketsToStorage(balances: Record<WalletTypeId, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of WALLET_TYPE_IDS) {
    out[id] = balances[id].toFixed(2);
  }
  return out;
}

export function canTransfer(from: WalletTypeId, to: WalletTypeId): boolean {
  return TRANSFER_RULES[from]?.includes(to) ?? false;
}

export function totalBalance(balances: Record<WalletTypeId, number>): number {
  return WALLET_TYPE_IDS.reduce((s, id) => s + balances[id], 0);
}

export function getWalletCatalog() {
  return {
    walletTypes: [
      { id: "main", label: "Recharge Wallet", rechargeable: true },
      { id: "cashback", label: "Cashback Wallet", rechargeable: false },
      { id: "refund", label: "Refund Wallet", rechargeable: false },
      { id: "reward", label: "Reward Wallet", rechargeable: false },
      { id: "gift", label: "Gift Wallet", rechargeable: false },
      { id: "membership", label: "Membership Wallet", rechargeable: false },
    ],
    rechargePresets: [100, 200, 500, 1000, 2000],
    transferRules: TRANSFER_RULES,
  };
}

export function buildCashbackSummary(
  transactions: { type: string; walletType?: string; amount: number; createdAt: Date | string }[],
) {
  const cashbackTx = transactions.filter(t => t.walletType === "cashback" || t.type === "cashback");
  const earned = cashbackTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const used = cashbackTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const transferOut = transactions.filter(t =>
    t.type === "transfer" && (t as { metadata?: { from?: string } }).metadata?.from === "cashback",
  ).reduce((s, t) => s + Math.abs(t.amount), 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthEarned = cashbackTx
    .filter(t => t.amount > 0 && new Date(t.createdAt) >= monthStart)
    .reduce((s, t) => s + t.amount, 0);

  const lastCredit = cashbackTx.find(t => t.amount > 0);

  return {
    totalEarned: Math.round(earned * 100) / 100,
    totalUsed: Math.round((used + transferOut) * 100) / 100,
    pendingCashback: 0,
    thisMonthEarned: Math.round(thisMonthEarned * 100) / 100,
    lastCashbackAt: lastCredit ? new Date(lastCredit.createdAt).toISOString() : null,
    recentEarned: cashbackTx
      .filter(t => t.amount > 0)
      .slice(0, 10)
      .map(t => ({
        orderId: (t as { referenceId?: string }).referenceId ?? "—",
        amount: t.amount,
        percent: 5,
        date: new Date(t.createdAt).toISOString(),
      })),
  };
}

export function applyRecharge(
  balances: Record<WalletTypeId, number>,
  amount: number,
): Record<WalletTypeId, number> {
  return { ...balances, main: balances.main + amount };
}

export function applyTransfer(
  balances: Record<WalletTypeId, number>,
  from: WalletTypeId,
  to: WalletTypeId,
  amount: number,
): Record<WalletTypeId, number> | null {
  if (!canTransfer(from, to) || amount <= 0 || balances[from] < amount) return null;
  return {
    ...balances,
    [from]: Math.round((balances[from] - amount) * 100) / 100,
    [to]: Math.round((balances[to] + amount) * 100) / 100,
  };
}
