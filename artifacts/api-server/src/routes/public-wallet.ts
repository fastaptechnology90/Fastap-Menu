import { Router, type IRouter, type Request } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, guestUsersTable, walletTransactionsTable } from "@workspace/db";
import {
  normalizeBuckets, bucketsToStorage, getWalletCatalog, buildCashbackSummary,
  applyRecharge, applyTransfer, totalBalance, canTransfer,
  type WalletTypeId, WALLET_TYPE_IDS,
} from "../lib/customerWalletLogic.js";

const router: IRouter = Router();

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

async function getGuestUser(req: Request) {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return null;
  const [user] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  return user ?? null;
}

async function persistBalances(guestId: number, balances: Record<WalletTypeId, number>) {
  const storage = bucketsToStorage(balances);
  await db.update(guestUsersTable).set({
    walletBuckets: storage,
    walletBalance: storage.main,
    cashbackBalance: storage.cashback,
  }).where(eq(guestUsersTable.id, guestId));
}

function walletSummary(guest: typeof guestUsersTable.$inferSelect) {
  const balances = normalizeBuckets(guest);
  return {
    balances,
    total: totalBalance(balances),
    balance: balances.main,
    cashback: balances.cashback,
  };
}

router.get("/public/wallet/catalog", (_req, res) => {
  res.json(getWalletCatalog());
});

router.get("/public/me/wallet", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const transactions = await db.select().from(walletTransactionsTable).where(
    eq(walletTransactionsTable.guestUserId, guest.id),
  ).orderBy(desc(walletTransactionsTable.createdAt)).limit(50);

  const summary = walletSummary(guest);
  res.json({
    ...summary,
    transactions: transactions.map(t => ({
      ...t,
      amount: parseNum(t.amount),
      balanceAfter: parseNum(t.balanceAfter),
    })),
    cashbackSummary: buildCashbackSummary(transactions.map(t => ({
      type: t.type,
      walletType: t.walletType ?? "main",
      amount: parseNum(t.amount),
      createdAt: t.createdAt,
      referenceId: t.referenceId ?? undefined,
      metadata: t.metadata as { from?: string } | undefined,
    }))),
  });
});

router.get("/public/me/wallet/transactions", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const walletType = String(req.query.walletType || "");
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 100);

  let query = db.select().from(walletTransactionsTable).where(
    eq(walletTransactionsTable.guestUserId, guest.id),
  ).orderBy(desc(walletTransactionsTable.createdAt)).limit(limit);

  const transactions = await query;
  const filtered = walletType && WALLET_TYPE_IDS.includes(walletType as WalletTypeId)
    ? transactions.filter(t => (t.walletType ?? "main") === walletType)
    : transactions;

  res.json({
    transactions: filtered.map(t => ({
      id: t.id,
      type: t.type,
      walletType: t.walletType ?? "main",
      amount: parseNum(t.amount),
      balanceAfter: parseNum(t.balanceAfter),
      description: t.description,
      referenceId: t.referenceId,
      metadata: t.metadata,
      createdAt: t.createdAt,
    })),
  });
});

router.get("/public/me/wallet/cashback", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const transactions = await db.select().from(walletTransactionsTable).where(
    and(eq(walletTransactionsTable.guestUserId, guest.id), eq(walletTransactionsTable.walletType, "cashback")),
  ).orderBy(desc(walletTransactionsTable.createdAt)).limit(100);

  const allTx = await db.select().from(walletTransactionsTable).where(
    eq(walletTransactionsTable.guestUserId, guest.id),
  ).orderBy(desc(walletTransactionsTable.createdAt)).limit(100);

  const balances = normalizeBuckets(guest);
  res.json({
    balance: balances.cashback,
    summary: buildCashbackSummary(allTx.map(t => ({
      type: t.type,
      walletType: t.walletType ?? "main",
      amount: parseNum(t.amount),
      createdAt: t.createdAt,
      referenceId: t.referenceId ?? undefined,
      metadata: t.metadata as { from?: string } | undefined,
    }))),
    transactions: transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: parseNum(t.amount),
      description: t.description,
      referenceId: t.referenceId,
      createdAt: t.createdAt,
    })),
  });
});

router.post("/public/me/wallet/recharge", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const amount = parseNum(req.body.amount);
  if (amount <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }

  const balances = applyRecharge(normalizeBuckets(guest), amount);
  await persistBalances(guest.id, balances);

  await db.insert(walletTransactionsTable).values({
    guestUserId: guest.id,
    restaurantId: req.session.restaurantId ?? null,
    type: "recharge",
    walletType: "main",
    amount: String(amount.toFixed(2)),
    balanceAfter: String(balances.main.toFixed(2)),
    description: req.body.method ? `Wallet recharge via ${req.body.method}` : "Wallet recharge",
    metadata: { method: req.body.method ?? "upi" },
  });

  res.json({ balances, balance: balances.main, success: true });
});

router.post("/public/me/wallet/transfer", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const from = String(req.body.from ?? "") as WalletTypeId;
  const to = String(req.body.to ?? "") as WalletTypeId;
  const amount = parseNum(req.body.amount);

  if (!WALLET_TYPE_IDS.includes(from) || !WALLET_TYPE_IDS.includes(to)) {
    res.status(400).json({ error: "Invalid wallet type" }); return;
  }
  if (from === to) { res.status(400).json({ error: "Cannot transfer to same wallet" }); return; }
  if (!canTransfer(from, to)) { res.status(400).json({ error: `Transfer from ${from} to ${to} not allowed` }); return; }
  if (amount <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }

  const current = normalizeBuckets(guest);
  const updated = applyTransfer(current, from, to, amount);
  if (!updated) { res.status(400).json({ error: "Insufficient balance" }); return; }

  await persistBalances(guest.id, updated);

  await db.insert(walletTransactionsTable).values({
    guestUserId: guest.id,
    restaurantId: req.session.restaurantId ?? null,
    type: "transfer",
    walletType: to,
    amount: String(amount.toFixed(2)),
    balanceAfter: String(updated[to].toFixed(2)),
    description: `Transfer from ${from} to ${to}`,
    metadata: { from, to },
  });

  await db.insert(walletTransactionsTable).values({
    guestUserId: guest.id,
    restaurantId: req.session.restaurantId ?? null,
    type: "transfer",
    walletType: from,
    amount: String((-amount).toFixed(2)),
    balanceAfter: String(updated[from].toFixed(2)),
    description: `Transfer to ${to}`,
    metadata: { from, to },
  });

  res.json({ balances: updated, total: totalBalance(updated), success: true });
});

export default router;
