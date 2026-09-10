import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Banknote, CalendarDays, Check, Download, Loader2, Lock,
  RefreshCw, Users, Wallet, Receipt, Scale,
} from "lucide-react";

import { useRestaurant } from "@/contexts/RestaurantContext";
import { dayEnd, type ApiError, type DayEndReport } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { downloadText } from "@/lib/download";

/**
 * The two readings a till has always had, and the one screen a manager closes the day on.
 *
 * X is where the day stands right now and can be taken as often as you like. Z is the
 * closing reading, and it refuses while a cash drawer is still open — because a drawer
 * that has not been counted cannot be reconciled, and a Z taken mid-shift is the classic
 * way a day's cash goes unaccounted for. That refusal is offered as a choice here rather
 * than swallowed, since a manager sometimes genuinely needs the figures anyway.
 *
 * This screen is read carefully rather than quickly, so it can afford density — and it
 * earns that density by being a reconciliation rather than a dashboard. The three
 * breakdowns each carry a total row, because the only question a Z reading exists to
 * answer is whether the parts add up to the whole.
 *
 * The reading bar stays pinned: taking a Z after reading four screens of figures used to
 * mean scrolling all the way back to the top to find the button.
 */

const money = (n: number) => `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Local date, not UTC — a venue's business day is the one on the wall calendar. */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function longDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const METHOD_LABEL: Record<string, string> = {
  upi: "UPI", cash: "Cash", card: "Card", wallet: "Wallet", nfc: "NFC",
  netbanking: "Netbanking", room_bill: "Room bill", uncollected: "Not collected",
};

const TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in", takeaway: "Takeaway", delivery: "Delivery", room_service: "Room service",
};

const card = "rounded-md border border-border bg-card";
const capLabel = "text-xs uppercase tracking-wide text-muted-foreground";

/**
 * One breakdown, as a real table: a header row so the middle column is named, and a
 * total row so the split can be checked against net sales. Scrolls inside its own
 * frame rather than taking the page sideways.
 */
function Breakdown({
  title, icon: Icon, rows, countLabel, compareTo,
}: {
  title: string;
  icon: typeof Receipt;
  rows: [string, { count?: number; orders?: number; amount: number }][];
  countLabel: string;
  /** Net sales, when this breakdown is expected to reconcile against it. */
  compareTo?: number;
}) {
  const totalCount = rows.reduce((s, [, v]) => s + (v.count ?? v.orders ?? 0), 0);
  const totalAmount = rows.reduce((s, [, v]) => s + Number(v.amount ?? 0), 0);
  const gap = compareTo != null ? totalAmount - compareTo : null;
  const reconciles = gap != null && Math.abs(gap) < 0.01;

  return (
    <section className={`${card} flex min-w-0 flex-col overflow-hidden`} aria-label={title}>
      <h3 className={`flex items-center gap-1.5 border-b border-border px-3 py-2.5 ${capLabel}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> {title}
      </h3>

      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing recorded for this day.</p>
      ) : (
        <div className="min-w-0 max-w-full flex-1 overflow-x-auto overscroll-x-contain">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-1.5 text-left font-medium">{title.replace(/^By /, "")}</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">{countLabel}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(([key, v]) => (
                <tr key={key}>
                  <td className="px-3 py-2">{key}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted-foreground">{v.count ?? v.orders ?? 0}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{money(v.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-background text-sm font-semibold">
                <td className="px-3 py-2">Total</td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{totalCount}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{money(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {gap != null && rows.length > 0 && (
        <p className={`border-t border-border px-3 py-2 text-2xs ${reconciles ? "text-success" : "text-warning"}`}>
          {reconciles
            ? "Adds up to net sales."
            : `${money(Math.abs(gap))} ${gap > 0 ? "more" : "less"} than net sales — an order counted under more than one heading, or one with no heading at all.`}
        </p>
      )}
    </section>
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
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when close/Z is refused because a drawer is still open or uncounted. */
  const [zBlocked, setZBlocked] = useState<{
    message: string;
    shiftsOpen: number;
    uncounted?: { id: number; staffName: string; cashSales: number }[];
  } | null>(null);

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

  /** Provisional Z look only — does not freeze the day. */
  async function previewZ(force: boolean) {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await dayEnd.z(restaurantId, date, force);
      setReport(res);
      setReportFor(date);
      setError(null);
      setZBlocked(null);
      toast({
        title: res.closed ? `Z-${res.zNumber} already on file for ${date}` : `Z preview for ${date}`,
        description: res.closed
          ? `Closed by ${res.closedBy ?? "staff"} — figures are frozen.`
          : force
            ? "Read with a shift still open — the drawer figures are provisional. The day is not closed."
            : "Provisional look only. Use Close the day to freeze these figures.",
      });
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

  /** Actually freeze the business day (POST). No fake success if drawers are open/uncounted. */
  async function closeDay() {
    if (!restaurantId) return;
    setClosing(true);
    setZBlocked(null);
    try {
      const res = await dayEnd.close(restaurantId, date);
      setReport(res);
      setReportFor(date);
      setError(null);
      toast({
        title: `Day closed — Z-${res.zNumber}`,
        description: `${date} is frozen. Later sales will not change this reading.`,
      });
    } catch (e) {
      const err = e as ApiError;
      const shiftsOpen = Number(err.detail?.shiftsOpen ?? 0);
      const uncounted = Array.isArray(err.detail?.uncountedShifts)
        ? (err.detail!.uncountedShifts as { id: number; staffName: string; cashSales: number }[])
        : undefined;
      if (err.status === 409 && (shiftsOpen > 0 || (uncounted && uncounted.length > 0))) {
        setZBlocked({
          message: err.message,
          shiftsOpen,
          uncounted,
        });
      } else {
        toast({
          title: "Could not close the day",
          description: err.message ?? "The server rejected it.",
          variant: "destructive",
        });
      }
    } finally {
      setClosing(false);
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
  const dayClosed = Boolean(report?.closed);
  const isZ = report?.reading === "Z";

  return (
    <div className="space-y-4">
      {/* ── The reading bar ─────────────────────────────────────────────────
          Pinned, because taking a Z after reading four screens of figures used
          to mean scrolling all the way back to the top to find the button. */}
      {/* Pulled out to the page gutter on all four sides so it covers the
          scroll container's own padding — otherwise rows scroll visibly through
          the 16px strip above an opaque bar. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-border bg-background px-4 pb-3 pt-4 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Day end</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              X reads where the day stands. Z closes it, and wants every drawer counted first.
            </p>
          </div>

          <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="date"
                value={date}
                max={todayLocal()}
                onChange={e => setDate(e.target.value)}
                aria-label="Business day"
                className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              />
            </div>
            <button
              type="button"
              onClick={() => loadX(date)}
              disabled={loading || closing}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-colors hover-elevate active-elevate-2 disabled:opacity-50 sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> X reading
            </button>
            <button
              type="button"
              onClick={() => previewZ(false)}
              disabled={loading || closing || report?.closed === true}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold transition-colors hover-elevate active-elevate-2 disabled:opacity-50 sm:flex-none"
            >
              Preview Z
            </button>
            <button
              type="button"
              onClick={() => closeDay()}
              disabled={loading || closing || report?.closed === true}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary-border bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover-elevate active-elevate-2 disabled:opacity-50 sm:w-auto"
            >
              {closing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
              {report?.closed ? `Closed (Z-${report.zNumber})` : "Close the day"}
            </button>
          </div>
        </div>
      </div>

      {zBlocked && (
        <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-warning-border bg-warning-subtle p-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {zBlocked.shiftsOpen > 0
                ? `${zBlocked.shiftsOpen} cash shift${zBlocked.shiftsOpen > 1 ? "s are" : " is"} still open`
                : "Drawer count missing"}
            </p>
            <p className="mt-1 text-xs text-warning">
              {zBlocked.message} The day stays open until this is fixed — nothing was closed.
            </p>
            {zBlocked.uncounted && zBlocked.uncounted.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-warning">
                {zBlocked.uncounted.map(s => (
                  <li key={s.id}>{s.staffName || `Shift #${s.id}`} — closed without a counted balance</li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setZBlocked(null)}
              className="flex min-h-11 items-center rounded-md border border-border bg-card px-3 text-xs font-semibold hover-elevate active-elevate-2"
            >
              I'll fix the drawer first
            </button>
            {zBlocked.shiftsOpen > 0 && (
              <button
                type="button"
                onClick={() => previewZ(true)}
                className="flex min-h-11 items-center rounded-md border border-warning-border bg-card px-3 text-xs font-semibold text-warning hover-elevate active-elevate-2"
              >
                Preview Z anyway
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-border bg-danger-subtle p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-danger">We could not read this day</p>
            <p className="mt-0.5 text-xs text-danger">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => loadX(date)}
            className="flex min-h-11 shrink-0 items-center rounded-md border border-danger-border bg-card px-3 text-xs font-semibold text-danger hover-elevate active-elevate-2"
          >
            Try again
          </button>
        </div>
      )}

      {!report && !error && loading && (
        <div className={`${card} p-10 text-center text-sm text-muted-foreground`} role="status">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
          Reading {longDate(date)}…
        </div>
      )}

      {!report && !error && !loading && (
        <div className={`${card} flex flex-col items-center px-6 py-14 text-center`}>
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Receipt className="h-6 w-6" aria-hidden />
          </span>
          <h2 className="text-base font-semibold">No reading yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Pick a business day above and take an X reading. Nothing is closed or changed by reading.
          </p>
        </div>
      )}

      {report && (
        <>
          {/* What am I looking at — the one thing that must not be ambiguous on a
              screen where one button permanently closes a business day. */}
          <div className={`${card} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-pill px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${
                    dayClosed ? "bg-primary text-primary-foreground" : isZ ? "bg-warning-subtle text-warning" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {dayClosed ? `Z-${report.zNumber}` : isZ ? "Z preview" : "X reading"}
                </span>
                <span className="text-sm font-semibold">{longDate(reportFor)}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dayClosed
                  ? `Closed by ${report.closedBy ?? "staff"}${report.closedAt ? ` · ${new Date(report.closedAt).toLocaleString("en-IN")}` : ""}. These figures are frozen.`
                  : isZ
                    ? "Provisional Z look — the day is still open. Close the day only after every drawer is counted."
                    : "Provisional — these figures move as the day goes on. Nothing has been closed."}
              </p>
            </div>
            <button
              type="button"
              onClick={exportReport}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-semibold hover-elevate active-elevate-2"
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> Export this reading
            </button>
          </div>

          {/* ── The reconciliation ────────────────────────────────────────
              Two halves, side by side from 1024px: what was sold on the left as
              a ledger that reads down to a total, what is in the drawer on the
              right. These two are the reading; everything below is detail. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={`${card} overflow-hidden`} aria-label="Sales">
              <h2 className={`flex items-center gap-1.5 border-b border-border px-4 py-2.5 ${capLabel}`}>
                <Scale className="h-3.5 w-3.5 shrink-0" aria-hidden /> Sales
              </h2>
              <dl className="divide-y divide-border">
                {([
                  ["Subtotal", report.sales.subtotal, ""],
                  ["Tax", report.sales.tax, ""],
                  ["Discounts", -report.sales.discounts, report.sales.discounts > 0 ? "text-danger" : ""],
                  ["Tips", report.sales.tips, ""],
                ] as [string, number, string][]).map(([label, value, tone]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className={`tabular-nums ${tone}`}>{money(value)}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 bg-background px-4 py-3">
                  <dt className="text-sm font-semibold">Net sales</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{money(report.sales.total)}</dd>
                </div>
              </dl>
              <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
                {([
                  ["Placed", String(report.orders.placed), ""],
                  ["Settled", String(report.orders.settled), "text-success"],
                  ["Cancelled", String(report.orders.cancelled), report.orders.cancelled > 0 ? "text-danger" : ""],
                  ["Average", money(report.sales.averageOrder), ""],
                ] as [string, string, string][]).map(([label, value, tone]) => (
                  <div key={label} className="min-w-0 bg-card px-3 py-2">
                    <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Cash — the variance is the number a manager is actually here for,
                so it is the largest thing in this half and it is coloured by
                whether it is zero, not by how big it is. */}
            <section
              className={`overflow-hidden rounded-md border ${varianceOk ? "border-success-border" : "border-danger-border"}`}
              aria-label="Cash drawer"
            >
              <h2 className={`flex items-center gap-1.5 border-b px-4 py-2.5 ${capLabel} ${varianceOk ? "border-success-border bg-success-subtle" : "border-danger-border bg-danger-subtle"}`}>
                <Banknote className="h-3.5 w-3.5 shrink-0" aria-hidden /> Cash drawer
              </h2>

              <div className={`px-4 py-4 ${varianceOk ? "bg-success-subtle" : "bg-danger-subtle"}`}>
                <p className={`text-3xl font-semibold tabular-nums leading-none ${varianceOk ? "text-success" : "text-danger"}`}>
                  {variance > 0 ? "+" : ""}{money(variance)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {varianceOk
                    ? "The drawer matches the orders exactly."
                    : variance > 0
                      ? "The drawer holds more than the orders account for — check for an uninvoiced sale or a float that was not recorded."
                      : "The drawer is short — check for a missed payment record, a refund paid in cash, or an unlogged payout."}
                </p>
              </div>

              <dl className="divide-y divide-border bg-card">
                {([
                  ["Opening float", money(report.cash.drawerOpening)],
                  ["Cash per orders", money(report.cash.takenPerOrders)],
                  ["Drawer counted", money(report.cash.drawerCounted)],
                  ["Shifts still open", String(report.cash.shiftsOpen)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              {report.cash.shiftsOpen > 0 && (
                <p className="flex items-start gap-1.5 border-t border-warning-border bg-warning-subtle px-4 py-2.5 text-xs text-warning">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    {report.cash.shiftsOpen} shift{report.cash.shiftsOpen > 1 ? "s have" : " has"} not been counted yet, so this variance is provisional.
                  </span>
                </p>
              )}
            </section>
          </div>

          {/* ── Where it came from ───────────────────────────────────────
              Each breakdown totals itself and says whether it reconciles to net
              sales, which is the whole point of taking a reading. Payment method
              and order type sit two-up; waiter runs full width because a busy
              venue has a dozen of them. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Breakdown
              title="By payment method"
              icon={Wallet}
              countLabel="Bills"
              compareTo={report.sales.total}
              rows={Object.entries(report.byPaymentMethod).map(([k, v]) => [METHOD_LABEL[k] ?? k, v])}
            />
            <Breakdown
              title="By order type"
              icon={Receipt}
              countLabel="Orders"
              compareTo={report.sales.total}
              rows={Object.entries(report.byOrderType).map(([k, v]) => [TYPE_LABEL[k] ?? k, v])}
            />
          </div>

          <Breakdown
            title="By waiter"
            icon={Users}
            countLabel="Orders"
            rows={Object.entries(report.byStaff).map(([k, v]) => [k, v])}
          />

          {/* ── Taken off the bills ──────────────────────────────────────── */}
          <section className={`${card} overflow-hidden`} aria-label="Adjustments">
            <h2 className={`flex items-center gap-1.5 border-b border-border px-4 py-2.5 ${capLabel}`}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden /> Taken off the bills
            </h2>

            {Object.keys(report.adjustments).length === 0 ? (
              <p className="flex items-center gap-1.5 px-4 py-4 text-sm text-success">
                <Check className="h-4 w-4 shrink-0" aria-hidden />
                Nothing was voided, comped or refunded on this day.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                {Object.entries(report.adjustments).map(([kind, v]) => (
                  <li key={kind} className="min-w-0 bg-card p-3">
                    <p className="truncate text-2xs uppercase tracking-wide capitalize text-muted-foreground">{kind}s</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-danger">{money(v.amount)}</p>
                    <p className="mt-0.5 text-2xs tabular-nums text-muted-foreground">
                      {v.count} time{v.count > 1 ? "s" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <p className="flex items-start gap-1.5 border-t border-border px-4 py-2.5 text-2xs text-muted-foreground">
              <Users className="mt-px h-3 w-3 shrink-0" aria-hidden />
              <span className="min-w-0">
                Every adjustment carries the reason and the person who made it — open the order in Live Orders to see them.
              </span>
            </p>
          </section>
        </>
      )}
    </div>
  );
}
