import { Router, type IRouter } from "express";
import { eq, and, desc, gte, sql, sum } from "drizzle-orm";
import { db, financeTransactionsTable, cashShiftsTable, ordersTable, platformSettlementsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  resolveAnalyticsAccess,
  sendAnalyticsNotFound,
  emptyFinanceSummary,
  emptyFinanceWallet,
} from "../lib/restaurant-publication.js";
import { isPaidOrder } from "../lib/payment-calculations.js";
import { round2 } from "../lib/order-pricing.js";
import { getCommissionRate } from "../lib/platform-admin.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/finance/transactions", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { type, days } = req.query;
  let query = db.select().from(financeTransactionsTable).where(eq(financeTransactionsTable.restaurantId, id));
  const txs = await db.select().from(financeTransactionsTable).where(eq(financeTransactionsTable.restaurantId, id)).orderBy(desc(financeTransactionsTable.createdAt)).limit(200);
  res.json(txs.map(t => ({ ...t, amount: parseFloat(String(t.amount)) })));
});

router.post("/restaurants/:restaurantId/finance/transactions", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { type, category, description, amount, paymentMethod, reference, orderId, performedBy } = req.body;
  const [tx] = await db.insert(financeTransactionsTable).values({
    restaurantId: id, type, category, description, amount: String(parseFloat(amount) || 0),
    paymentMethod, reference, orderId: orderId ? parseInt(orderId) : null, performedBy,
  }).returning();
  res.status(201).json({ ...tx, amount: parseFloat(String(tx.amount)) });
});

router.get("/restaurants/:restaurantId/finance/summary", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") { res.json(emptyFinanceSummary()); return; }

  const txs = await db.select().from(financeTransactionsTable).where(eq(financeTransactionsTable.restaurantId, id));
  const sum = (rows: typeof txs) => rows.reduce((s, t) => s + parseFloat(String(t.amount)), 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const isToday = (t: typeof txs[number]) => new Date(t.createdAt) >= todayStart;

  // A cancelled order books a matching "refund" row. Netting it off here keeps
  // Finance in step with Revenue, which drops a cancelled order outright —
  // otherwise money handed back to the guest kept showing as income.
  const grossIncome = sum(txs.filter(t => t.type === "income"));
  const totalRefund = sum(txs.filter(t => t.type === "refund"));
  const totalIncome = grossIncome - totalRefund;
  const totalExpense = sum(txs.filter(t => t.type === "expense"));
  const netProfit = totalIncome - totalExpense;
  const todayIncome = sum(txs.filter(t => t.type === "income" && isToday(t)))
    - sum(txs.filter(t => t.type === "refund" && isToday(t)));
  res.json({ totalIncome, totalExpense, totalRefund, netProfit, todayIncome, transactionCount: txs.length });
});

router.get("/restaurants/:restaurantId/cash-shifts", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const shifts = await db.select().from(cashShiftsTable).where(eq(cashShiftsTable.restaurantId, id)).orderBy(desc(cashShiftsTable.openedAt)).limit(50);
  res.json(shifts.map(s => ({
    ...s,
    openingBalance: parseFloat(String(s.openingBalance)),
    closingBalance: s.closingBalance ? parseFloat(String(s.closingBalance)) : null,
    cashSales: parseFloat(String(s.cashSales)),
    cashExpenses: parseFloat(String(s.cashExpenses)),
  })));
});

router.post("/restaurants/:restaurantId/cash-shifts", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { staffName, staffRole, openingBalance, denominations } = req.body;
  await db.update(cashShiftsTable).set({ status: "closed", closedAt: new Date() }).where(and(eq(cashShiftsTable.restaurantId, id), eq(cashShiftsTable.status, "open")));
  const [shift] = await db.insert(cashShiftsTable).values({ restaurantId: id, staffName, staffRole, openingBalance: String(parseFloat(openingBalance) || 0), denominations }).returning();
  res.status(201).json(shift);
});

router.put("/restaurants/:restaurantId/cash-shifts/:shiftId/close", requireAuth, async (req, res): Promise<void> => {
  const shiftId = parseInt(req.params.shiftId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { closingBalance, notes } = req.body;
  const [shift] = await db.select().from(cashShiftsTable).where(and(eq(cashShiftsTable.id, shiftId), eq(cashShiftsTable.restaurantId, restaurantId)));
  if (!shift) { res.status(404).json({ error: "Shift not found" }); return; }
  const expected = parseFloat(String(shift.openingBalance)) + parseFloat(String(shift.cashSales)) - parseFloat(String(shift.cashExpenses));
  const closing = parseFloat(closingBalance);
  const mismatch = Math.abs(expected - closing) > 1;
  const [updated] = await db.update(cashShiftsTable).set({ status: "closed", closedAt: new Date(), closingBalance: String(closing), expectedBalance: String(expected), notes, mismatchAlert: mismatch }).where(eq(cashShiftsTable.id, shiftId)).returning();
  res.json(updated);
});

router.get("/restaurants/:restaurantId/cash-shifts/active", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const [shift] = await db.select().from(cashShiftsTable).where(and(eq(cashShiftsTable.restaurantId, id), eq(cashShiftsTable.status, "open")));
  res.json(shift ? { ...shift, openingBalance: parseFloat(String(shift.openingBalance)), cashSales: parseFloat(String(shift.cashSales)) } : null);
});

const ONLINE_METHODS = new Set(["upi", "card", "netbanking", "wallet", "online", "razorpay", "gateway"]);

router.get("/restaurants/:restaurantId/finance/wallet", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const access = await resolveAnalyticsAccess(req, id);
  if (access.kind === "not_found") { sendAnalyticsNotFound(res); return; }
  if (access.kind === "unpublished") {
    res.json({
      ...emptyFinanceWallet(),
      lockedBalance: 0,
      reserveBalance: 0,
      totalCashSales: 0,
      commission: 0,
      taxCollected: 0,
      onlineTransactions: [],
      cashLedger: [],
    });
    return;
  }

  const orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, id));
  const txs = await db.select().from(financeTransactionsTable).where(eq(financeTransactionsTable.restaurantId, id));

  let totalOnlineSales = 0;
  let totalCashSales = 0;
  let refundAmount = 0;
  let taxCollected = 0;
  for (const o of orders) {
    if (o.paymentStatus === "refunded") { refundAmount += parseFloat(String(o.total)); continue; }
    // Tax is only collected on a bill that was paid. Summing it over every row counted
    // GST on abandoned and cancelled orders as money owed to the tax authority.
    if (isPaidOrder(o)) taxCollected += parseFloat(String(o.tax || 0));
    // Same PAID rule as owner dashboard / analytics / super-admin — one consistent number.
    if (!isPaidOrder(o)) continue;
    const method = (o.paymentMethod || "cash").toLowerCase();
    const amt = parseFloat(String(o.total));
    if (ONLINE_METHODS.has(method)) totalOnlineSales += amt;
    else totalCashSales += amt;
  }
  // "Sales" revenue = orders only, so the finance panel's revenue equals what the owner,
  // analytics and super-admin panels show for the same restaurant. Order-linked ledger rows
  // are already counted above; manual (non-order) income is shown in the ledger/summary but
  // is NOT folded into sales revenue. Non-order refunds still reduce the payout.
  for (const t of txs) {
    if (t.orderId) continue;
    if (t.type === "refund") refundAmount += parseFloat(String(t.amount));
  }

  // Four figures here were fractions of other figures and measured nothing: a 2% fee
  // while the platform charged whatever its commission rule said, half of refunds
  // deducted rather than all of them, 15% of the balance called "pending settlement" and
  // 5% called "reserve". The fee is now the platform's real rate, and settlement figures
  // come from this venue's settlement rows. Nothing here holds a reserve, so the panel is
  // told there is none rather than being handed a percentage.
  const commissionRate = (await getCommissionRate()) / 100;
  const commission = totalOnlineSales * commissionRate;
  const onlineBalance = totalOnlineSales - commission - refundAmount;
  const settlementRows = await db.select().from(platformSettlementsTable)
    .where(eq(platformSettlementsTable.restaurantId, id));
  const isReleased = (r: typeof settlementRows[number]) => String(r.status ?? "").toLowerCase() === "released";
  const isHeld = (r: typeof settlementRows[number]) => String(r.status ?? "").toLowerCase() === "hold";
  const money = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
  const pendingSettlement = settlementRows.filter(r => !isReleased(r) && !isHeld(r))
    .reduce((t, r) => t + money(r.finalPayout), 0);
  const lockedBalance = settlementRows.filter(isHeld).reduce((t, r) => t + money(r.finalPayout), 0);
  const reserveBalance = null;

  const onlineTxns = orders
    .filter(o => ONLINE_METHODS.has((o.paymentMethod || "").toLowerCase()))
    .slice(0, 50)
    .map(o => {
      const md = (o.metadata ?? {}) as Record<string, any>;
      const pay = (md.payment ?? {}) as Record<string, any>;
      return {
        id: `ORD-${o.id}`,
        type: (o.paymentMethod || "upi").toLowerCase(),
        amount: parseFloat(String(o.total)),
        gateway: (pay.gatewayId as string) || (md.gatewayId as string) || null,
        // A UTR is a bank's own reference. Minting one from the order id put a number on
        // screen that no bank statement would ever match; an unrecorded reference is null.
        utr: pay.utr || null,
        upiId: pay.upiId ?? null,
        collectedBy: pay.collectedBy ?? null,
        collectedFrom: pay.collectedFrom ?? null,
        customerName: o.customerName ?? null,
        tableName: o.tableName ?? null,
        tax: parseFloat(String(o.tax)),
        commission: round2(parseFloat(String(o.total)) * commissionRate),
        net: round2(parseFloat(String(o.total)) * (1 - commissionRate)),
        time: new Date(o.createdAt).toLocaleString("en-IN"),
        status: o.paymentStatus === "refunded" ? "refund" : o.paymentStatus === "paid" ? "success" : "pending",
      };
    });

  // Every ledger line carried a balance of 0, so the column was decoration. Walk the cash
  // entries oldest-first to get a real running balance, then show the most recent ones.
  const cashRows = txs
    .filter(t => !ONLINE_METHODS.has((t.paymentMethod || "cash").toLowerCase()))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(t => ({
      at: new Date(t.createdAt).getTime(),
      date: new Date(t.createdAt).toLocaleDateString("en-IN"),
      type: t.type === "expense" ? "expense" : "sale",
      amount: t.type === "expense" ? -(parseFloat(String(t.amount)) || 0) : (parseFloat(String(t.amount)) || 0),
      note: t.description,
      balance: 0,
    }));
  let running = 0;
  for (const row of cashRows) {
    running = Math.round((running + row.amount) * 100) / 100;
    row.balance = running;
  }
  const cashLedger = cashRows.slice(-30).reverse().map(({ at: _at, ...row }) => row);

  // Every figure below is money. Rounding it to whole rupees, as this did, means the
  // wallet can never be reconciled against a bank statement — the paise are real.
  res.json({
    onlineBalance: round2(onlineBalance),
    pendingSettlement: round2(pendingSettlement),
    lockedBalance: round2(lockedBalance),
    reserveBalance,
    commissionRatePercent: Math.round(commissionRate * 10000) / 100,
    totalCashSales: round2(totalCashSales),
    totalOnlineSales: round2(totalOnlineSales),
    refundAmount: round2(refundAmount),
    taxCollected: round2(taxCollected),
    pendingRefunds: round2(refundAmount),
    onlineTxns,
    cashLedger,
    // One invented settlement row used to stand in for the schedule. These are the
    // venue's real settlement records.
    settlements: settlementRows
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(r => ({
        id: `STL${String(r.id).padStart(3, "0")}`,
        amount: round2(money(r.finalPayout)),
        grossSales: money(r.grossSales),
        commission: money(r.commission),
        refunds: money(r.refunds),
        penalties: money(r.penalties),
        utr: null,
        bank: "Settlement Account",
        date: new Date(r.createdAt).toLocaleDateString("en-IN"),
        dueDate: r.dueDate ? new Date(r.dueDate).toLocaleDateString("en-IN") : null,
        releasedAt: r.releasedAt ? new Date(r.releasedAt).toISOString() : null,
        status: r.status,
        mode: "NEFT",
      })),
    // Net profit ignored expenses entirely — it was revenue minus the platform fee, which
    // is a gross figure with a fee taken off, not a profit. Recorded expenses come off too.
    pnl: (() => {
      const revenue = Math.round((totalOnlineSales + totalCashSales) * 100) / 100;
      const expenses = Math.round(txs.filter(t => t.type === "expense")
        .reduce((t, x) => t + (parseFloat(String(x.amount)) || 0), 0) * 100) / 100;
      const netProfit = Math.round((revenue - commission - expenses) * 100) / 100;
      return {
        revenue,
        commission: Math.round(commission * 100) / 100,
        expenses,
        netProfit,
        margin: revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0,
      };
    })(),
  });
});

router.get("/restaurants/:restaurantId/finance/export", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, id));
  const txs = await db.select().from(financeTransactionsTable).where(eq(financeTransactionsTable.restaurantId, id)).orderBy(desc(financeTransactionsTable.createdAt)).limit(200);
  const lines = [
    "FastMenu Finance Export",
    `Generated,${new Date().toISOString()}`,
    "",
    "Orders",
    "ID,Total,Payment Method,Status,Created",
    ...orders.slice(0, 100).map(o => `${o.id},${o.total},${o.paymentMethod || "cash"},${o.paymentStatus || o.status},${o.createdAt}`),
    "",
    "Transactions",
    "ID,Type,Category,Amount,Method,Description,Created",
    ...txs.map(t => `${t.id},${t.type},${t.category},${t.amount},${t.paymentMethod || ""},"${String(t.description || "").replace(/"/g, '""')}",${t.createdAt}`),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="finance-${id}.csv"`);
  res.send(lines.join("\n"));
});

export default router;
