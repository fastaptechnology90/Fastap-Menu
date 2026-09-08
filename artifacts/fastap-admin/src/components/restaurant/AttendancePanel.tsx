import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, LogIn, LogOut, Loader2, UserCheck } from "lucide-react";

import {
  attendance as attendanceApi,
  type AttendanceShift,
  type AttendanceSummaryRow,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/restaurant/EmptyState";

/**
 * Clock in, clock out, and who is on the floor.
 *
 * The only record of a shift used to be a single word on the staff row — "morning" — so
 * nobody could answer who worked yesterday, for how long, or what they sold. Those three
 * are exactly what payroll and commission are calculated from, which is why the range
 * view leads with the per-person summary rather than a list of raw punches.
 */

export type AttendanceStaff = { id: string; name: string; role: string };

const money = (n: number) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function onFloorFor(since: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function clockTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function AttendancePanel({
  restaurantId,
  staff,
}: {
  restaurantId: number | null;
  staff: AttendanceStaff[];
}) {
  const [open, setOpen] = useState<AttendanceShift[]>([]);
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryRow[]>([]);
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clockInPick, setClockInPick] = useState("");
  const [breakMinutes, setBreakMinutes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | "in" | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [openRows, range] = await Promise.all([
        attendanceApi.open(restaurantId),
        attendanceApi.range(restaurantId, from, to),
      ]);
      setOpen(Array.isArray(openRows) ? openRows : []);
      setShifts(range.shifts ?? []);
      setSummary(range.summary ?? []);
      setError(null);
    } catch (e) {
      // An empty roster and an unreachable server must not look the same.
      setError(e instanceof Error ? e.message : "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, from, to]);

  useEffect(() => { load(); }, [load]);

  const onFloorIds = useMemo(() => new Set(open.map(s => s.staffId)), [open]);
  const clockableIn = staff.filter(s => !onFloorIds.has(parseInt(s.id, 10)));

  async function clockIn() {
    if (!restaurantId || !clockInPick) return;
    setBusy("in");
    try {
      const shift = await attendanceApi.clockIn(restaurantId, parseInt(clockInPick, 10));
      toast({ title: `${shift.staffName} clocked in`, description: `On the floor from ${clockTime(shift.clockedInAt)}.` });
      setClockInPick("");
      await load();
    } catch (e: any) {
      // A second open shift is refused with a 409 that names the time they went on —
      // that is the useful sentence, so it is shown rather than replaced.
      toast({ title: "Could not clock in", description: e?.message ?? "The server rejected it.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function clockOut(shift: AttendanceShift) {
    if (!restaurantId) return;
    const mins = Number(breakMinutes[shift.staffId] ?? "");
    setBusy(shift.staffId);
    try {
      const closed = await attendanceApi.clockOut(
        restaurantId,
        shift.staffId,
        Number.isFinite(mins) && mins > 0 ? mins : undefined,
      );
      toast({
        title: `${closed.staffName} clocked out`,
        description: `${closed.hours} h worked · ${money(Number(closed.salesDuringShift ?? 0))} sold during the shift.`,
      });
      setBreakMinutes(b => ({ ...b, [shift.staffId]: "" }));
      await load();
    } catch (e: any) {
      toast({ title: "Could not clock out", description: e?.message ?? "The server rejected it.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
        <div>
          <p className="text-sm font-semibold text-red-200">We could not load attendance.</p>
          <p className="text-xs text-red-200/70">{error} This is not an empty log.</p>
        </div>
        <button type="button" onClick={load} className="shrink-0 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-100">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Who is on the floor right now ── */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
            <UserCheck className="h-3.5 w-3.5" /> On the floor now
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">{open.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <select
              value={clockInPick}
              onChange={e => setClockInPick(e.target.value)}
              aria-label="Staff member to clock in"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
            >
              <option value="">Clock someone in…</option>
              {clockableIn.map(s => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
            </select>
            <button
              type="button"
              onClick={clockIn}
              disabled={!clockInPick || busy === "in"}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {busy === "in" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />} Clock in
            </button>
          </div>
        </div>

        {loading && open.length === 0 ? (
          <p className="mt-3 text-xs text-white/30">Loading…</p>
        ) : open.length === 0 ? (
          <p className="mt-3 text-xs text-white/30">Nobody is clocked in. Use the picker above as staff arrive.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {open.map(shift => (
              <div key={shift.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{shift.staffName}</p>
                  <p className="text-xs text-white/40">
                    {shift.staffRole} · in at {clockTime(shift.clockedInAt)} · {onFloorFor(shift.clockedInAt)} on the floor
                  </p>
                </div>
                <input
                  value={breakMinutes[shift.staffId] ?? ""}
                  onChange={e => setBreakMinutes(b => ({ ...b, [shift.staffId]: e.target.value }))}
                  inputMode="numeric"
                  placeholder="Break (min)"
                  aria-label={`Break minutes for ${shift.staffName}`}
                  className="w-24 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs placeholder:text-white/25 focus:border-amber-500/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => clockOut(shift)}
                  disabled={busy === shift.staffId}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-white/10 disabled:opacity-40"
                >
                  {busy === shift.staffId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Clock out
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── The period a payroll run reads ── */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-white/30" />
        <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} aria-label="From date"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs focus:border-amber-500/40 focus:outline-none" />
        <span className="text-xs text-white/30">to</span>
        <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} aria-label="To date"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs focus:border-amber-500/40 focus:outline-none" />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
      </div>

      {summary.length === 0 && shifts.length === 0 && !loading ? (
        <EmptyState
          title="No shifts in this period"
          description="Clock someone in above, or widen the dates. Hours and shift sales are recorded at clock-out."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/8">
            <div className="border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
              <p className="text-xs uppercase tracking-wider text-white/40">Per person · {from} to {to}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-white/40">
                    {["Staff", "Role", "Shifts", "Hours", "Sales during shifts"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.map(row => (
                    <tr key={row.staffId} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 font-semibold">{row.name}</td>
                      <td className="px-4 py-2.5 text-xs capitalize text-white/50">{row.role}</td>
                      <td className="px-4 py-2.5 tabular-nums text-white/70">{row.shifts}</td>
                      <td className="px-4 py-2.5 tabular-nums font-semibold text-amber-400">{row.hours}</td>
                      <td className="px-4 py-2.5 tabular-nums text-emerald-400">{money(row.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/8">
            <div className="border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
              <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
                <Clock className="h-3.5 w-3.5" /> Every shift ({shifts.length})
              </p>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0e1520]">
                  <tr className="border-b border-white/5 text-xs text-white/40">
                    {["Staff", "Date", "In", "Out", "Break", "Hours", "Sales"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {shifts.map(s => (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">{s.staffName}</td>
                      <td className="px-4 py-2.5 text-xs text-white/50">
                        {new Date(s.clockedInAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-2.5 text-xs">{clockTime(s.clockedInAt)}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {s.clockedOutAt
                          ? clockTime(s.clockedOutAt)
                          : <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">STILL IN</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white/50">{s.breakMinutes ? `${s.breakMinutes}m` : "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums text-xs text-white/70">
                        {s.minutesWorked != null ? (Math.max(0, s.minutesWorked - s.breakMinutes) / 60).toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-xs text-emerald-400">
                        {s.salesDuringShift != null ? money(Number(s.salesDuringShift)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
