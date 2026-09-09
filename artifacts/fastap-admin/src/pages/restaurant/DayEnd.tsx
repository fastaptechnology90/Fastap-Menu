import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Banknote, CalendarDays, Check, Loader2, Lock, RefreshCw, Users, Wallet,
} from "lucide-react";

import { useRestaurant } from "@/contexts/RestaurantContext";
import { dayEnd, type ApiError, type DayEndReport } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { downloadText } from "@/lib/download";
import { EmptyState } from "@/components/restaurant/EmptyState";

/**
 * The two readings a till has always had, and the one screen a manager closes the day on.
 *
 * X is where the day stands right now and can be taken as often as you like. Z is the
 * closing reading, and it refuses while a cash drawer is still open — because a drawer
 * that has not been counted cannot be reconciled, and a Z taken mid-shift is the classic
 * way a day's cash goes unaccounted for. That refusal is offered as a choice here rather
 * than swallowed, since a manager sometimes genuinely needs the figures anyway.
 */

const money = (n: number) => `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Local date, not UTC — a venue's business day is the one on the wall calendar. */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const METHOD_LABEL: Record<string, string> = {
  upi: "UPI", cash: "Cash", card: "Card", wallet: "Wallet", nfc: "NFC",
  netbanking: "Netbanking", room_bill: "Room bill", uncollected: "Not collected",
};

const TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in", takeaway: "Takeaway", delivery: "Delivery", room_service: "Room service",
};

function Breakdown({
  title,
  rows,
  countLabel,
}: {
  title: string;
  rows: [string, { count?: number; orders?: number; amount: number }][];
  countLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Nothing recorded for this day.</p>
      ) : (
        <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-border">
              {rows.map(([key, v]) => (
                <tr key={key}>
                  <td className="py-2 pr-2 text-foreground">{key}</td>
                  <td className="py-2 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {v.count ?? v.orders ?? 0} {countLabel}
                  </td>
                  <td className="py-2 pl-3 text-right font-semibold text-primary whitespace-nowrap">{money(v.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DayEnd() {
  const { restaurantId, restaurant } = useRestaurant();
  const [date, setDate] = useState(todayLocal());
  const [report, setReport] = useState<DayEndReport | null>(null);
  // The business day these figures cover. The report is windowed on the venue's own
  // midnight, so the day asked for is the accurate label to show and to print.
  const [reportFor, setReportFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when a Z is refused because a drawer is still open, so the choice can be offered. */
  const [zBlocked, setZBlocked] = useState<{ message: string; shiftsOpen: number } | null>(null);

  const loadX = useCallback(async (forDate: string) => {
    if (!restaurantId) return;
    setLoading(true);
    setZBlocked(null);
    try {
      setReport(await dayEnd.x(restaurantId, forDate));
      setReportFor(forDate);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the day's figures.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // The X reading is the safe default: it changes nothing and answers "where are we now".
  useEffect(() => { loadX(date); }, [loadX, date]);

  async function takeZ(force: boolean) {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await dayEnd.z(restaurantId, date, force);
      setReport(res);
      setReportFor(date);
      setError(null);
      setZBlocked(null);
      toast({ title: `Z reading taken for ${date}`, description: force ? "Read with a shift still open — the drawer figures are provisional." : undefined });
    } catch (e) {
      const err = e as ApiError;
      const shiftsOpen = Number(err.detail?.shiftsOpen ?? 0);
      if (err.status === 409 && shiftsOpen > 0) {
        setZBlocked({ message: err.message, shiftsOpen });
      } else {
        toast({ title: "Could not take the Z reading", description: err.message ?? "The server rejected it.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    if (!report) return;
    const lines = [
      `${restaurant.name || "Venue"} — ${report.reading} reading`,
      `Business day: ${reportFor}`,
      `Taken: ${new Date().toLocaleString("en-IN")}`,
      "",
      `Orders placed: ${report.orders.placed}`,
      `Settled: ${report.orders.settled}   Cancelled: ${report.orders.cancelled}   Refunded: ${report.orders.refunded}`,
      "",
      `Subtotal: ${money(report.sales.subtotal)}`,
      `Tax: ${money(report.sales.tax)}`,
      `Discounts: ${money(report.sales.discounts)}`,
      `Tips: ${money(report.sales.tips)}`,
      `TOTAL: ${money(report.sales.total)}`,
      `Average order: ${money(report.sales.averageOrder)}`,
      "",
      "By payment method:",
      ...Object.entries(report.byPaymentMethod).map(([k, v]) => `  ${METHOD_LABEL[k] ?? k}: ${v.count} × ${money(v.amount)}`),
      "",
      "By order type:",
      ...Object.entries(report.byOrderType).map(([k, v]) => `  ${TYPE_LABEL[k] ?? k}: ${v.count} × ${money(v.amount)}`),
      "",
      "By waiter:",
      ...Object.entries(report.byStaff).map(([k, v]) => `  ${k}: ${v.orders} orders, ${money(v.amount)}`),
      "",
      "Adjustments:",
      ...(Object.keys(report.adjustments).length === 0
        ? ["  none"]
        : Object.entries(report.adjustments).map(([k, v]) => `  ${k}: ${v.count} × ${money(v.amount)}`)),
      "",
      "Cash:",
      `  Taken per orders: ${money(report.cash.takenPerOrders)}`,
      `  Drawer opening: ${money(report.cash.drawerOpening)}`,
      `  Drawer counted: ${money(report.cash.drawerCounted)}`,
      `  VARIANCE: ${money(report.cash.variance)}`,
      `  Shifts still open: ${report.cash.shiftsOpen}`,
    ].join("\n");
    downloadText(lines, `${report.reading.toLowerCase()}-reading-${reportFor}.txt`);
  }

  const variance = report?.cash.variance ?? 0;
  const varianceOk = Math.abs(variance) < 0.01;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Day End</h1>
          <p className="text-xs text-muted-foreground">
            X is the reading right now. Z closes the business day and needs every cash drawer counted first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={date}
              max={todayLocal()}
              onChange={e => setDate(e.target.value)}
              aria-label="Business day"
              className="rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm focus:border-primary/40 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => loadX(date)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-semibold transition-colors hover-elevate disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-primary ${loading ? "animate-spin" : ""}`} /> X reading
          </button>
          <button
            type="button"
            onClick={() => takeZ(false)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Z reading
          </button>
        </div>
      </div>

      {zBlocked && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-border bg-warning-subtle p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-warning">
              <AlertTriangle className="h-4 w-4" />
              {zBlocked.shiftsOpen} cash shift{zBlocked.shiftsOpen > 1 ? "s are" : " is"} still open
            </p>
            <p className="mt-1 text-xs text-warning">
              {zBlocked.message} Until the drawer is counted the cash variance below cannot be trusted.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setZBlocked(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              I'll close them first
            </button>
            <button
              type="button"
              onClick={() => takeZ(true)}
              className="rounded-lg bg-warning-subtle px-3 py-2 text-xs font-semibold text-warning hover-elevate"
            >
              Read anyway
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-danger-border bg-danger-subtle p-4">
          <div>
            <p className="text-sm font-semibold text-danger">We could not read this day.</p>
            <p className="text-xs text-danger">{error}</p>
          </div>
          <button type="button" onClick={() => loadX(date)} className="shrink-0 rounded-lg bg-danger-subtle px-3 py-1.5 text-xs font-semibold text-danger">
            Try again
          </button>
        </div>
      )}

      {!report && !error && !loading && (
        <EmptyState title="No reading yet" description="Pick a business day above and take an X reading." />
      )}

      {report && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${report.reading === "Z" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {report.reading} reading
            </span>
            <span className="text-xs text-muted-foreground">Business day {reportFor}</span>
            <button type="button" onClick={exportReport} className="ml-auto rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold hover-elevate">
              Export
            </button>
          </div>

          {/* Cash first — the variance is the number a manager is actually looking for. */}
          <div className={`rounded-lg border p-4 ${varianceOk ? "border-success-border bg-success-subtle" : "border-danger-border bg-danger-subtle"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" /> Cash drawer
                </p>
                <p className={`mt-1 text-3xl font-semibold ${varianceOk ? "text-success" : "text-danger"}`}>
                  {variance > 0 ? "+" : ""}{money(variance)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {varianceOk
                    ? "The drawer matches the orders exactly."
                    : variance > 0
                      ? "The drawer holds more than the orders account for — check for an uninvoiced sale or a float that was not recorded."
                      : "The drawer is short — check for a missed payment record, a refund paid in cash, or an unlogged payout."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                {[
                  ["Opening float", money(report.cash.drawerOpening)],
                  ["Cash per orders", money(report.cash.takenPerOrders)],
                  ["Drawer counted", money(report.cash.drawerCounted)],
                  ["Shifts open", String(report.cash.shiftsOpen)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-2xs text-muted-foreground">{label}</p>
                    <p className="font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            {report.cash.shiftsOpen > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                {report.cash.shiftsOpen} shift{report.cash.shiftsOpen > 1 ? "s have" : " has"} not been counted yet, so this variance is provisional.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Net sales", value: money(report.sales.total), tone: "text-primary" },
              { label: "Orders settled", value: `${report.orders.settled} of ${report.orders.placed}`, tone: "text-success" },
              { label: "Average order", value: money(report.sales.averageOrder), tone: "text-info" },
              { label: "Cancelled / refunded", value: `${report.orders.cancelled} / ${report.orders.refunded}`, tone: "text-danger" },
            ].map(tile => (
              <div key={tile.label} className="rounded-lg border border-border bg-card p-4">
                <p className={`text-xl font-semibold ${tile.tone}`}>{tile.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Sales</p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5">
              {[
                ["Subtotal", report.sales.subtotal],
                ["Tax", report.sales.tax],
                ["Discounts", -report.sales.discounts],
                ["Tips", report.sales.tips],
                ["Total", report.sales.total],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-2xs text-muted-foreground">{label}</p>
                  <p className="font-semibold tabular-nums">{money(value as number)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Breakdown
              title="By payment method"
              countLabel="bills"
              rows={Object.entries(report.byPaymentMethod).map(([k, v]) => [METHOD_LABEL[k] ?? k, v])}
            />
            <Breakdown
              title="By order type"
              countLabel="orders"
              rows={Object.entries(report.byOrderType).map(([k, v]) => [TYPE_LABEL[k] ?? k, v])}
            />
            <Breakdown
              title="By waiter"
              countLabel="orders"
              rows={Object.entries(report.byStaff).map(([k, v]) => [k, v])}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Taken off the bills
            </p>
            {Object.keys(report.adjustments).length === 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Nothing was voided, comped or refunded on this day.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(report.adjustments).map(([kind, v]) => (
                  <div key={kind} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs capitalize text-muted-foreground">{kind}s</p>
                    <p className="text-lg font-semibold text-danger">{money(v.amount)}</p>
                    <p className="text-2xs text-muted-foreground">{v.count} time{v.count > 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Users className="h-3 w-3" /> Every adjustment carries the reason and the person who made it — open the order in Live Orders to see them.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
