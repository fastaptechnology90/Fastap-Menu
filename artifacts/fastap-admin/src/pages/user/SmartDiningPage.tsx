import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  TABLE_INTERACTION_REQUESTS, BILL_MODES, DEFAULT_BILL_CONFIG,
  type BillMode, type DiningBillConfig, type RunningBillLine,
  lineTotal, computeBillSummary,
} from "@/lib/smartDiningCatalog";
import {
  ChevronLeft, CheckCircle, Phone, User2, Receipt, Users,
  RefreshCw, CreditCard, Split, Armchair, ShoppingBag, AlertCircle,
} from "lucide-react";

interface SentRequest {
  label: string;
  time: Date;
  status: "sent" | "acknowledged" | "done";
}

function billStorageKey(table: string) {
  return `fastap_bill_${table || "default"}`;
}

export default function SmartDiningPage() {
  const [, navigate] = useAppLocation();
  const { cart, orders, activeTable, activeRestaurant, venue } = useUser();
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [billConfig, setBillConfig] = useState<DiningBillConfig>(() => {
    try {
      const raw = localStorage.getItem(billStorageKey(activeTable));
      return raw ? { ...DEFAULT_BILL_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_BILL_CONFIG };
    } catch { return { ...DEFAULT_BILL_CONFIG }; }
  });
  const [apiLines, setApiLines] = useState<RunningBillLine[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [payToast, setPayToast] = useState<string | null>(null);
  const [payingGroup, setPayingGroup] = useState(false);
  const [apiSplit, setApiSplit] = useState<{ splits?: { person: number; amount: number }[]; seats?: { seat: number; amount: number }[] } | null>(null);

  useEffect(() => {
    localStorage.setItem(billStorageKey(activeTable), JSON.stringify(billConfig));
  }, [billConfig, activeTable]);

  const fetchRunningBill = useCallback(async () => {
    if (venue.restaurantId || venue.restaurantSlug) {
      try {
        const data = await publicApi.dining.runningBill({
          restaurantId: venue.restaurantId ?? undefined,
          slug: venue.restaurantSlug,
          table: activeTable,
        });
        setApiLines((data.lines as RunningBillLine[]).map(l => ({
          ...l,
          seat: 1,
          paid: l.paid ?? false,
        })));
        setLastUpdated(new Date(data.updatedAt));
      } catch { /* use local */ }
    }
  }, [venue.restaurantId, venue.restaurantSlug, activeTable]);

  useEffect(() => {
    fetchRunningBill();
    const t = setInterval(fetchRunningBill, 8000);
    return () => clearInterval(t);
  }, [fetchRunningBill]);

  // A cart line's `price` is already the full unit price the guest was shown, with the
  // portion and every add-on folded in. Adding the add-ons again here billed the table
  // more for the same food than the order it came from.
  const cartLines: RunningBillLine[] = useMemo(() =>
    cart.map(c => ({
      id: `cart-${c.id}`,
      name: c.name,
      unitPrice: c.price,
      quantity: c.quantity,
      lineTotal: lineTotal(c.price, c.quantity),
      seat: billConfig.seatAssignments[c.id] ?? 1,
      paid: false,
      source: "cart" as const,
    })),
  [cart, billConfig.seatAssignments]);

  const orderLines: RunningBillLine[] = useMemo(() =>
    orders
      .filter(o => o.tableNo === activeTable || !activeTable)
      .flatMap(o => o.items.map((item, idx) => ({
        id: `order-${o.id}-${item.id}-${idx}`,
        name: item.name,
        unitPrice: item.price,
        quantity: item.quantity,
        lineTotal: lineTotal(item.price, item.quantity),
        seat: billConfig.seatAssignments[item.id] ?? 1,
        // Only the server decides whether money has changed hands.
        paid: o.paymentStatus === "paid",
        source: "order" as const,
        orderId: o.id,
      }))),
  [orders, activeTable, billConfig.seatAssignments]);

  const allLines = useMemo(() => {
    const merged = [...orderLines, ...cartLines];
    if (apiLines.length > 0) {
      // Deduplicate on line id, not on dish name — a table that ordered chai in the
      // first round and again in the second had the second one dropped from the bill.
      const ids = new Set(merged.map(l => l.id));
      for (const l of apiLines) {
        if (!ids.has(l.id)) merged.push({ ...l, seat: billConfig.seatAssignments[l.id] ?? 1 });
      }
    }
    return merged;
  }, [cartLines, orderLines, apiLines, billConfig.seatAssignments]);

  const summary = computeBillSummary(allLines, billConfig);
  // `paidItemIds` is the guest's own tick-list of which dishes are theirs. It has never
  // been a record of payment — nothing on this page can take money for single items —
  // so it drives the "your items" figure and nothing else.
  const selectedIds = billConfig.paidItemIds;
  const selectedTotal = allLines
    .filter(l => !l.paid && selectedIds.includes(l.id))
    .reduce((s, l) => s + l.lineTotal, 0);
  const selectedWithGst = Math.round(selectedTotal * 1.05);
  const amountDue = summary.total;

  // Real assigned waiter for this table (falls back to "being assigned" until
  // the kitchen marks an order ready and auto-assignment picks a waiter).
  const assignedWaiter = useMemo(
    () => orders.find(o => (o.tableNo === activeTable || !activeTable) && o.waiterName)?.waiterName,
    [orders, activeTable],
  );

  async function sendRequest(label: string, type: string) {
    if (!venue.restaurantId) {
      // Silently doing nothing left the guest tapping "Call Waiter" over and over.
      setPayToast("We do not know which restaurant you are in. Scan the QR code on your table and try again.");
      setTimeout(() => setPayToast(null), 5000);
      return;
    }
    try {
      await publicApi.waiterCall({
        restaurantId: venue.restaurantId,
        tableId: venue.tableId,
        tableName: activeTable,
        type,
        message: label,
      });
    } catch {
      // A guest told "waiter notified" who was never notified just sits waiting.
      setPayToast("We could not reach the staff. Please try again or wave someone over.");
      setTimeout(() => setPayToast(null), 4000);
      return;
    }
    setSent(prev => [{ label, time: new Date(), status: "sent" }, ...prev]);
    setToast(label);
    setTimeout(() => setToast(null), 3000);
    // The list used to flip to "On the way" on a 3.5-second timer. No member of staff
    // had acknowledged anything; there is no acknowledgement to poll for. A guest who
    // believes someone is coming stops looking for one.
  }

  function setMode(mode: BillMode) {
    setBillConfig(c => ({ ...c, mode }));
    const unpaid = allLines.filter(l => !l.paid);
    const modeMap: Record<string, string> = { split: "equal", seat_wise: "seat_wise", item_wise: "item_wise" };
    if (modeMap[mode]) {
      publicApi.dining.splitBill({
        lines: unpaid,
        splitCount: billConfig.splitCount,
        seatCount: billConfig.seatCount,
        mode: modeMap[mode],
      }).then(setApiSplit).catch(() => setApiSplit(null));
    }
  }

  function assignSeat(lineId: string, seat: number) {
    setBillConfig(c => ({ ...c, seatAssignments: { ...c.seatAssignments, [lineId]: seat } }));
  }

  /** Tick the dishes that are yours, so the page can total your share. */
  function toggleSelected(lineId: string) {
    setBillConfig(c => ({
      ...c,
      paidItemIds: c.paidItemIds.includes(lineId)
        ? c.paidItemIds.filter(id => id !== lineId)
        : [...c.paidItemIds, lineId],
    }));
  }

  async function payGroup() {
    if (payingGroup) return;
    const total = summary.total;
    if (!venue.restaurantId) {
      setPayToast("We do not know which restaurant you are in. Scan the QR code on your table and try again.");
      setTimeout(() => setPayToast(null), 5000);
      return;
    }
    setPayingGroup(true);
    try {
      // `dining.groupPayment` only works the arithmetic out — it takes no money and
      // records nothing. The bill was still being marked paid afterwards, so the whole
      // table could be shown a settled bill and walk out owing every rupee of it. Until
      // there is an endpoint that actually collects, the honest thing is to tell the
      // floor one person is settling and let the counter take the payment.
      await publicApi.waiterCall({
        restaurantId: venue.restaurantId,
        tableId: venue.tableId,
        tableName: activeTable,
        type: "group_payment",
        message: `One bill for the table — ₹${total}${billConfig.groupPayerName ? ` (paying: ${billConfig.groupPayerName})` : ""}`,
      });
    } catch (e) {
      setPayToast(e instanceof Error ? e.message : "We could not reach the staff. Please settle at the counter.");
      setTimeout(() => setPayToast(null), 5000);
      setPayingGroup(false);
      return;
    }
    setPayToast(`Staff notified — one bill of ₹${total} for the table${billConfig.groupPayerName ? `, paying: ${billConfig.groupPayerName}` : ""}. Nothing has been charged yet.`);
    setTimeout(() => setPayToast(null), 6000);
    setPayingGroup(false);
  }

  function paySelectedItems() {
    if (selectedTotal <= 0) {
      setPayToast("Tick the dishes that are yours first.");
      setTimeout(() => setPayToast(null), 4000);
      return;
    }
    // This used to announce "Item-wise payment: ₹…" and then do nothing at all — no
    // request, no record, nothing marked paid. A guest could walk out believing their
    // share was settled. There is no per-item payment endpoint, so say so plainly.
    setPayToast(`Your share is ₹${selectedWithGst}. Paying for individual items in the app isn't available yet — please settle it at the counter.`);
    setTimeout(() => setPayToast(null), 6000);
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-10">
      <div className="guest-header px-4 py-3 flex items-center gap-3">
        <GuestBackButton />
        <div className="flex-1">
          <h1 className="font-bold">Smart Dining Experience</h1>
          <p className="text-xs text-white/40">{activeRestaurant} · Table {activeTable}</p>
        </div>
        <button onClick={fetchRunningBill} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Waiter strip */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-orange-500/30 to-pink-500/20 flex items-center justify-center text-lg">👨</div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{assignedWaiter ? `${assignedWaiter} · Your Waiter` : "Your Waiter"}</p>
            {assignedWaiter ? (
              <p className="text-xs text-emerald-400 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online</p>
            ) : (
              <p className="text-xs text-white/45 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white/40" /> Being assigned…</p>
            )}
          </div>
          <button onClick={() => sendRequest("Called your waiter", "call_waiter")} title="Call waiter" className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30"><Phone className="h-4 w-4 text-emerald-400" /></button>
        </div>

        {/* Table Interaction — all 9 features */}
        <div className="rounded-2xl bg-gradient-to-br from-orange-600/15 to-amber-600/5 border border-orange-500/20 p-4">
          <p className="text-sm font-semibold mb-3">Table Interaction</p>
          <div className="grid grid-cols-3 gap-2">
            {TABLE_INTERACTION_REQUESTS.map(req => (
              <button
                key={req.id}
                onClick={() => sendRequest(req.label, req.type)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 transition-all"
              >
                <span className="text-2xl">{req.icon}</span>
                <span className="text-[10px] text-white/70 text-center leading-tight px-1">{req.label}</span>
              </button>
            ))}
          </div>
        </div>

        {sent.length > 0 && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Recent Requests</p>
            {sent.slice(0, 4).map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                <div className="h-2 w-2 rounded-full bg-orange-400" />
                <span className="flex-1">{r.label}</span>
                <span className="text-xs text-white/40">Sent</span>
              </div>
            ))}
          </div>
        )}

        {/* Smart Bill */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600/15 to-teal-600/5 border border-emerald-500/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4 text-emerald-400" /> Smart Bill</p>
            <span className="text-[10px] text-white/40">Updated {lastUpdated.toLocaleTimeString()}</span>
          </div>

          {/* Live running bill header */}
          <div className="rounded-xl bg-black/25 border border-emerald-500/20 p-4 mb-4 text-center">
            <p className="text-xs text-emerald-300/80 mb-1">Live Running Bill</p>
            {/* The headline used to add every line's value to the GST of the unpaid ones
                only, so it matched neither the total nor what was still owed. */}
            <p className="text-4xl font-extrabold text-emerald-400">₹{amountDue}</p>
            <p className="text-xs text-white/40 mt-1">
              {allLines.length} items · incl. GST
              {summary.paidTotal > 0 ? ` · ₹${summary.paidTotal} already settled` : ""}
            </p>
          </div>

          {/* Bill mode tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {BILL_MODES.filter(m => m.id !== "live").map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`shrink-0 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-all ${billConfig.mode === m.id ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-white/50"}`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/40 mb-3">{BILL_MODES.find(m => m.id === billConfig.mode)?.desc}</p>

          {/* Mode-specific controls */}
          {billConfig.mode === "split" && (
            <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-white/5">
              <Split className="h-4 w-4 text-emerald-400" />
              <button onClick={() => setBillConfig(c => ({ ...c, splitCount: Math.max(2, c.splitCount - 1) }))} className="h-7 w-7 rounded-lg bg-white/10">−</button>
              <span className="flex-1 text-center text-sm font-bold">{billConfig.splitCount} guests · ₹{apiSplit?.splits?.[0]?.amount ?? summary.perPerson} each</span>
              <button onClick={() => setBillConfig(c => ({ ...c, splitCount: Math.min(12, c.splitCount + 1) }))} className="h-7 w-7 rounded-lg bg-white/10">+</button>
            </div>
          )}
          {apiSplit?.splits && billConfig.mode === "split" && (
            <div className="mb-3 space-y-1">
              {apiSplit.splits.map(s => (
                <div key={s.person} className="flex justify-between text-xs text-white/50 px-2">
                  <span>Guest {s.person}</span><span>₹{s.amount}</span>
                </div>
              ))}
            </div>
          )}
          {apiSplit?.seats && billConfig.mode === "seat_wise" && (
            <div className="mb-3 space-y-1">
              {apiSplit.seats.map(s => (
                <div key={s.seat} className="flex justify-between text-xs text-white/50 px-2">
                  <span>Seat {s.seat}</span><span>₹{s.amount}</span>
                </div>
              ))}
            </div>
          )}

          {billConfig.mode === "seat_wise" && (
            <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-white/5">
              <Armchair className="h-4 w-4 text-emerald-400" />
              <button onClick={() => setBillConfig(c => ({ ...c, seatCount: Math.max(1, c.seatCount - 1) }))} className="h-7 w-7 rounded-lg bg-white/10">−</button>
              <span className="flex-1 text-center text-sm font-bold">{billConfig.seatCount} seats</span>
              <button onClick={() => setBillConfig(c => ({ ...c, seatCount: Math.min(12, c.seatCount + 1) }))} className="h-7 w-7 rounded-lg bg-white/10">+</button>
            </div>
          )}

          {billConfig.mode === "group" && (
            <input
              className="w-full mb-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40"
              placeholder="Group payer name (who pays for all)"
              value={billConfig.groupPayerName}
              onChange={e => setBillConfig(c => ({ ...c, groupPayerName: e.target.value }))}
            />
          )}

          {/* Bill lines */}
          <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
            {allLines.length === 0 ? (
              <p className="text-center text-sm text-white/30 py-6">No items yet — order from menu</p>
            ) : allLines.map(line => (
              <div key={line.id} className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm ${line.paid ? "bg-emerald-500/10 border-emerald-500/20 opacity-60" : "bg-white/5 border-white/10"}`}>
                {billConfig.mode === "item_wise" && (
                  <button
                    onClick={() => toggleSelected(line.id)}
                    disabled={line.paid}
                    aria-label={`Mark ${line.name} as mine`}
                    className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 disabled:opacity-30 ${selectedIds.includes(line.id) ? "bg-emerald-500 border-emerald-500" : "border-white/30"}`}
                  >
                    {selectedIds.includes(line.id) && <CheckCircle className="h-3 w-3 text-white" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{line.quantity}× {line.name}</p>
                  <p className="text-[10px] text-white/40 capitalize">{line.source}{line.orderId ? ` #${line.orderId}` : ""}</p>
                </div>
                {billConfig.mode === "seat_wise" && (
                  <select
                    className="bg-white/10 border border-white/10 rounded-lg text-xs px-1 py-1"
                    value={line.seat}
                    onChange={e => assignSeat(line.id, parseInt(e.target.value, 10))}
                  >
                    {Array.from({ length: billConfig.seatCount }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>Seat {s}</option>
                    ))}
                  </select>
                )}
                <span className="font-bold text-emerald-400 shrink-0">₹{line.lineTotal}</span>
              </div>
            ))}
          </div>

          {/* Seat-wise breakdown */}
          {billConfig.mode === "seat_wise" && Object.keys(summary.seatTotals).length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-white/5 space-y-1">
              <p className="text-xs text-white/40 mb-2">Per Seat</p>
              {Object.entries(summary.seatTotals).map(([seat, amt]) => (
                <div key={seat} className="flex justify-between text-sm">
                  <span>Seat {seat}</span>
                  <span className="text-emerald-400 font-semibold">₹{amt}</span>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="border-t border-white/10 pt-3 space-y-1.5 text-sm mb-4">
            <div className="flex justify-between text-white/50"><span>Subtotal (unpaid)</span><span>₹{summary.subtotal}</span></div>
            <div className="flex justify-between text-white/50"><span>GST 5%</span><span>₹{summary.gst}</span></div>
            {summary.paidTotal > 0 && <div className="flex justify-between text-emerald-400"><span>Already paid</span><span>₹{summary.paidTotal}</span></div>}
            {billConfig.mode === "item_wise" && selectedTotal > 0 && (
              <div className="flex justify-between text-emerald-300"><span>Your items (incl. GST)</span><span>₹{selectedWithGst}</span></div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <span>{billConfig.mode === "split" ? "Your share" : billConfig.mode === "shared" ? "Shared total" : "Amount due"}</span>
              <span className="text-emerald-400">₹{billConfig.mode === "split" ? summary.perPerson : summary.total}</span>
            </div>
          </div>

          {/* Payment actions */}
          <div className="flex gap-2">
            {billConfig.mode === "item_wise" ? (
              <button onClick={paySelectedItems} disabled={summary.unpaidCount === 0} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 font-bold text-sm flex items-center justify-center gap-2">
                <CreditCard className="h-4 w-4" /> My share · ₹{selectedWithGst}
              </button>
            ) : billConfig.mode === "group" ? (
              <button onClick={payGroup} className="flex-1 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 font-bold text-sm flex items-center justify-center gap-2">
                <Users className="h-4 w-4" /> Group Pay · ₹{summary.total}
              </button>
            ) : (
              <button onClick={() => navigate("/user/cart")} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-sm flex items-center justify-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Checkout · ₹{billConfig.mode === "split" ? summary.perPerson : summary.total}
              </button>
            )}
            <button onClick={() => sendRequest("Request Bill", "request_bill")} className="px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold">
              🧾 Bill
            </button>
          </div>
        </div>

        {/* Shared billing note */}
        {billConfig.mode === "shared" && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2 text-xs text-blue-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Shared billing combines all table orders into one bill. Anyone at the table can view the live total.
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> {toast} — Waiter notified!
        </div>
      )}
      {payToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-violet-600 text-white px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm">
          {payToast}
        </div>
      )}
    </div>
  );
}
