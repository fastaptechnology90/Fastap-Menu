import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useWaiterCalls, WaiterCallStatusList } from "@/components/user/WaiterCallStatus";
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
  UserRound,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

function billStorageKey(table: string) {
  return `fastap_bill_${table || "default"}`;
}

export default function SmartDiningPage() {
  const [, navigate] = useAppLocation();
  const { cart, orders, activeTable, activeRestaurant, venue } = useUser();
  const [toast, setToast] = useState<string | null>(null);
  /**
   * What the floor has actually seen.
   *
   * "Recent Requests" was a list this page kept in its own state: every entry read
   * "Sent" for ever, and an earlier version flipped them to "On the way" on a 3.5-second
   * timer with no member of staff involved. `GET /public/waiter-calls` reports whether
   * anyone has picked the call up, so the guest is told the truth either way.
   */
  const { calls: waiterCalls, refresh: refreshWaiterCalls } = useWaiterCalls(venue.restaurantId, activeTable);
  const [billConfig, setBillConfig] = useState<DiningBillConfig>(() => {
    try {
      const raw = localStorage.getItem(billStorageKey(activeTable));
      return raw ? { ...DEFAULT_BILL_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_BILL_CONFIG };
    } catch { return { ...DEFAULT_BILL_CONFIG }; }
  });
  const [apiLines, setApiLines] = useState<RunningBillLine[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [payToast, setPayToast] = useState<string | null>(null);
  const [apiSplit, setApiSplit] = useState<{ splits?: { person: number; amount: number }[]; seats?: { seat: number; amount: number }[] } | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

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
    refreshWaiterCalls();
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
      setSplitError(null);
      publicApi.dining.splitBill({
        lines: unpaid,
        splitCount: billConfig.splitCount,
        seatCount: billConfig.seatCount,
        mode: modeMap[mode],
      }).then(data => {
        setApiSplit(data);
        setSplitError(null);
      }).catch(e => {
        // Failure used to clear the split quietly so the UI fell back to a local
        // estimate with no hint that the server share was wrong.
        setApiSplit(null);
        setSplitError(e instanceof Error ? e.message : "Could not calculate the bill split.");
      });
    } else {
      setSplitError(null);
      setApiSplit(null);
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

  // In-app Pay Selected / Group Pay used to look like checkout. There is still no
  // endpoint that collects money here — keep the controls disabled and labelled.

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-10">
      <div className="guest-header px-4 py-3 flex items-center gap-3">
        <GuestBackButton />
        <div className="flex-1">
          <h1 className="font-semibold">Smart Dining Experience</h1>
          <p className="text-xs text-muted-foreground">{activeRestaurant} · Table {activeTable}</p>
        </div>
        <button onClick={fetchRunningBill} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Waiter strip */}
        <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0"><UserRound className="h-5 w-5 text-muted-foreground" /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{assignedWaiter ? `${assignedWaiter} · Your Waiter` : "Your Waiter"}</p>
            {assignedWaiter ? (
              <p className="text-xs text-success flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Online</p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Being assigned…</p>
            )}
          </div>
          <button onClick={() => sendRequest("Called your waiter", "call_waiter")} title="Call waiter" className="h-9 w-9 rounded-xl bg-success-subtle border border-success-border flex items-center justify-center hover:bg-success-subtle"><Phone className="h-4 w-4 text-success" /></button>
        </div>

        {/* Table Interaction — all 9 features */}
        <div className="rounded-2xl border border-primary p-4">
          <p className="text-sm font-semibold mb-3">Table Interaction</p>
          <div className="grid grid-cols-3 gap-2">
            {TABLE_INTERACTION_REQUESTS.map(req => (
              <button
                key={req.id}
                onClick={() => sendRequest(req.label, req.type)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted hover:bg-muted border border-border hover:border-primary transition-all"
              >
                <GuestIcon id={req.id} className="h-5 w-5 text-primary" />
                <span className="text-2xs text-muted-foreground text-center leading-tight px-1">{req.label}</span>
              </button>
            ))}
          </div>
        </div>

        {waiterCalls.length > 0 && (
          <div className="guest-section-card">
            <p className="guest-section-label mb-2">Your requests</p>
            <WaiterCallStatusList calls={waiterCalls} limit={4} />
          </div>
        )}

        {/* Smart Bill */}
        <div className="rounded-2xl border border-success-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4 text-success" /> Smart Bill</p>
            <span className="text-2xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</span>
          </div>

          {/* Live running bill header */}
          <div className="rounded-xl bg-foreground/40 border border-success-border p-4 mb-4 text-center">
            <p className="text-xs text-success mb-1">Live Running Bill</p>
            {/* The headline used to add every line's value to the GST of the unpaid ones
                only, so it matched neither the total nor what was still owed. */}
            <p className="text-4xl font-semibold text-success">₹{amountDue}</p>
            <p className="text-xs text-muted-foreground mt-1">
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
                className={`shrink-0 px-3 py-2 rounded-xl text-2xs font-semibold border transition-all ${billConfig.mode === m.id ? "bg-success-subtle border-success-border text-success" : "bg-muted border-border text-muted-foreground"}`}
              >
                <><GuestIcon id={m.id} className="h-3.5 w-3.5" /> {m.label}</>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{BILL_MODES.find(m => m.id === billConfig.mode)?.desc}</p>

          {/* Mode-specific controls */}
          {billConfig.mode === "split" && (
            <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-muted">
              <Split className="h-4 w-4 text-success" />
              <button onClick={() => setBillConfig(c => ({ ...c, splitCount: Math.max(2, c.splitCount - 1) }))} className="h-7 w-7 rounded-lg bg-muted">−</button>
              <span className="flex-1 text-center text-sm font-semibold">{billConfig.splitCount} guests · ₹{apiSplit?.splits?.[0]?.amount ?? summary.perPerson} each</span>
              <button onClick={() => setBillConfig(c => ({ ...c, splitCount: Math.min(12, c.splitCount + 1) }))} className="h-7 w-7 rounded-lg bg-muted">+</button>
            </div>
          )}
          {splitError && (
            <p role="alert" className="mb-3 text-xs text-danger bg-danger-subtle border border-danger-border rounded-xl px-3 py-2">{splitError}</p>
          )}
          {apiSplit?.splits && billConfig.mode === "split" && (
            <div className="mb-3 space-y-1">
              {apiSplit.splits.map(s => (
                <div key={s.person} className="flex justify-between text-xs text-muted-foreground px-2">
                  <span>Guest {s.person}</span><span>₹{s.amount}</span>
                </div>
              ))}
            </div>
          )}
          {apiSplit?.seats && billConfig.mode === "seat_wise" && (
            <div className="mb-3 space-y-1">
              {apiSplit.seats.map(s => (
                <div key={s.seat} className="flex justify-between text-xs text-muted-foreground px-2">
                  <span>Seat {s.seat}</span><span>₹{s.amount}</span>
                </div>
              ))}
            </div>
          )}

          {billConfig.mode === "seat_wise" && (
            <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-muted">
              <Armchair className="h-4 w-4 text-success" />
              <button onClick={() => setBillConfig(c => ({ ...c, seatCount: Math.max(1, c.seatCount - 1) }))} className="h-7 w-7 rounded-lg bg-muted">−</button>
              <span className="flex-1 text-center text-sm font-semibold">{billConfig.seatCount} seats</span>
              <button onClick={() => setBillConfig(c => ({ ...c, seatCount: Math.min(12, c.seatCount + 1) }))} className="h-7 w-7 rounded-lg bg-muted">+</button>
            </div>
          )}

          {billConfig.mode === "group" && (
            <input
              className="w-full mb-3 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-success-border"
              placeholder="Group payer name (who pays for all)"
              value={billConfig.groupPayerName}
              onChange={e => setBillConfig(c => ({ ...c, groupPayerName: e.target.value }))}
            />
          )}

          {/* Bill lines */}
          <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
            {allLines.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No items yet — order from menu</p>
            ) : allLines.map(line => (
              <div key={line.id} className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm ${line.paid ? "bg-success-subtle border-success-border opacity-60" : "bg-muted border-border"}`}>
                {billConfig.mode === "item_wise" && (
                  <button
                    onClick={() => toggleSelected(line.id)}
                    disabled={line.paid}
                    aria-label={`Mark ${line.name} as mine`}
                    className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 disabled:opacity-30 ${selectedIds.includes(line.id) ? "bg-primary border-success-border" : "border-border"}`}
                  >
                    {selectedIds.includes(line.id) && <CheckCircle className="h-3 w-3 text-foreground" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{line.quantity}× {line.name}</p>
                  <p className="text-2xs text-muted-foreground capitalize">{line.source}{line.orderId ? ` #${line.orderId}` : ""}</p>
                </div>
                {billConfig.mode === "seat_wise" && (
                  <select
                    className="bg-muted border border-border rounded-lg text-xs px-1 py-1"
                    value={line.seat}
                    onChange={e => assignSeat(line.id, parseInt(e.target.value, 10))}
                  >
                    {Array.from({ length: billConfig.seatCount }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>Seat {s}</option>
                    ))}
                  </select>
                )}
                <span className="font-semibold text-success shrink-0">₹{line.lineTotal}</span>
              </div>
            ))}
          </div>

          {/* Seat-wise breakdown */}
          {billConfig.mode === "seat_wise" && Object.keys(summary.seatTotals).length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-muted space-y-1">
              <p className="text-xs text-muted-foreground mb-2">Per Seat</p>
              {Object.entries(summary.seatTotals).map(([seat, amt]) => (
                <div key={seat} className="flex justify-between text-sm">
                  <span>Seat {seat}</span>
                  <span className="text-success font-semibold">₹{amt}</span>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="border-t border-border pt-3 space-y-1.5 text-sm mb-4">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal (unpaid)</span><span>₹{summary.subtotal}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>GST 5%</span><span>₹{summary.gst}</span></div>
            {summary.paidTotal > 0 && <div className="flex justify-between text-success"><span>Already paid</span><span>₹{summary.paidTotal}</span></div>}
            {billConfig.mode === "item_wise" && selectedTotal > 0 && (
              <div className="flex justify-between text-success"><span>Your items (incl. GST)</span><span>₹{selectedWithGst}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base pt-1">
              <span>{billConfig.mode === "split" ? "Your share" : billConfig.mode === "shared" ? "Shared total" : "Amount due"}</span>
              <span className="text-success">₹{billConfig.mode === "split" ? summary.perPerson : summary.total}</span>
            </div>
          </div>

          {/* Payment actions — item/group pay have no collection endpoint yet */}
          <div className="space-y-2">
            <div className="flex gap-2">
              {billConfig.mode === "item_wise" ? (
                <button
                  type="button"
                  disabled
                  title="In-app item payment is not available yet"
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground border border-border font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
                >
                  <CreditCard className="h-4 w-4" /> Pay Selected · unavailable
                </button>
              ) : billConfig.mode === "group" ? (
                <button
                  type="button"
                  disabled
                  title="In-app group payment is not available yet"
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground border border-border font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
                >
                  <Users className="h-4 w-4" /> Group Pay · unavailable
                </button>
              ) : (
                <button onClick={() => navigate("/user/cart")} className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-sm flex items-center justify-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> Checkout · ₹{billConfig.mode === "split" ? summary.perPerson : summary.total}
                </button>
              )}
              <button onClick={() => sendRequest("Request Bill", "request_bill")} className="px-4 py-3 rounded-xl border border-border bg-muted text-sm font-semibold">
                Bill
              </button>
            </div>
            {(billConfig.mode === "item_wise" || billConfig.mode === "group") && (
              <p className="text-xs text-muted-foreground">
                {billConfig.mode === "item_wise"
                  ? `Your selected share is ₹${selectedWithGst} (incl. GST). Paying for individual items in the app isn’t available yet — request the bill or settle at the counter.`
                  : `Table total ₹${summary.total}. Group pay in the app isn’t available yet — request the bill or settle at the counter.`}
              </p>
            )}
          </div>
        </div>

        {/* Shared billing note */}
        {billConfig.mode === "shared" && (
          <div className="rounded-xl bg-info-subtle border border-info-border p-3 flex gap-2 text-xs text-info">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Shared billing combines all table orders into one bill. Anyone at the table can view the live total.
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> {toast} — Waiter notified!
        </div>
      )}
      {payToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm">
          {payToast}
        </div>
      )}
    </div>
  );
}
