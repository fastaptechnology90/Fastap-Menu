import { useCallback, useEffect, useState } from "react";
import {
  BellRing, CheckCircle2, Loader2,
  Hand, GlassWater, Scroll, Utensils, BookOpen, Brush, Snowflake, Music2, Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Did anybody pick the call up?
 *
 * A guest pressed "Call waiter", got "Waiter notified", and then had nothing at all —
 * no way to tell a call a member of staff had walked over for from one nobody had seen.
 * `/user/dining` went further and flipped its own list to "On the way" on a 3.5-second
 * timer with no member of staff involved, which is worse than silence: a guest who
 * believes someone is coming stops looking for one.
 *
 * The staff panel already resolves these rows, and `GET /public/waiter-calls` reports
 * that back per table. This polls it and shows what actually happened.
 */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export interface WaiterCallState {
  id: number;
  type: string;
  message: string | null;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  statusLabel: string;
}

/**
 * `lib/api.ts` is shared by all three panels and is not this role's file to edit, so the
 * one guest-side read it is missing is done here against the same base URL and the same
 * cookie behaviour every other call uses.
 */
export async function fetchWaiterCalls(restaurantId: number, tableName: string): Promise<WaiterCallState[]> {
  const qs = new URLSearchParams({ restaurantId: String(restaurantId), table: tableName });
  const res = await fetch(`${BASE}/public/waiter-calls?${qs.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not read the call status");
  const body = await res.json();
  return Array.isArray(body) ? body as WaiterCallState[] : [];
}

/** Poll the table's calls while the screen is open. Returns [] when we have no table. */
export function useWaiterCalls(restaurantId: number | null, tableName: string | null | undefined, enabled = true) {
  const [calls, setCalls] = useState<WaiterCallState[]>([]);
  const table = (tableName ?? "").trim();

  const refresh = useCallback(async () => {
    if (!restaurantId || !table) { setCalls([]); return; }
    try {
      setCalls(await fetchWaiterCalls(restaurantId, table));
    } catch {
      // A failed poll is not worth interrupting the guest for; the next tick retries.
    }
  }, [restaurantId, table]);

  useEffect(() => {
    if (!enabled || !restaurantId || !table) return;
    refresh();
    // Fifteen seconds: fast enough that "someone is coming" arrives while the guest is
    // still looking at the screen, slow enough not to hammer the venue's server from
    // every open table.
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [enabled, restaurantId, table, refresh]);

  return { calls, refresh };
}

function minutesAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

/** The list of calls this table has made, and whether each has been picked up. */
export function WaiterCallStatusList({
  calls,
  emptyLabel = "No calls yet.",
  limit = 5,
}: {
  calls: WaiterCallState[];
  emptyLabel?: string;
  limit?: number;
}) {
  if (calls.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {calls.slice(0, limit).map(c => (
        <li key={c.id} className="flex items-start gap-2.5 text-sm">
          {c.acknowledged
            ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            : <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 animate-spin" />}
          <div className="min-w-0 flex-1">
            <p className="truncate">{c.message || c.type.replace(/_/g, " ")}</p>
            <p className={`text-xs ${c.acknowledged ? "text-success" : "text-muted-foreground"}`}>
              {c.acknowledged
                ? `Picked up${c.acknowledgedAt ? ` ${minutesAgo(c.acknowledgedAt)}` : ""}`
                : `Waiting for a team member · sent ${minutesAgo(c.createdAt)}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A one-line banner for the most recent unanswered or just-answered call. */
export function WaiterCallBanner({ calls }: { calls: WaiterCallState[] }) {
  const latest = calls[0];
  if (!latest) return null;
  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
        latest.acknowledged
          ? "border-success-border bg-success-subtle text-success"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {latest.acknowledged
        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
        : <BellRing className="h-4 w-4 shrink-0" />}
      <span className="min-w-0 flex-1">
        {latest.acknowledged
          ? `A team member has picked up your request${latest.acknowledgedAt ? ` — ${minutesAgo(latest.acknowledgedAt)}` : ""}.`
          : `Your request is with the floor — sent ${minutesAgo(latest.createdAt)}. Nobody has picked it up yet.`}
      </span>
    </div>
  );
}

/**
 * Icons for the table-service requests in `TABLE_INTERACTION_REQUESTS`.
 *
 * The catalog carries an emoji per request (🙋 💧 🧻 🍴 📋 🧹 ❄️ 🎵 💡). Emoji render
 * differently on every phone, take no colour, do not scale with the type and carry no
 * accessible name — and this row is nine of them side by side on a 375px screen. Both
 * screens that render the row read this map instead.
 */
export const SERVICE_REQUEST_ICONS: Record<string, LucideIcon> = {
  call_waiter: Hand,
  request_water: GlassWater,
  request_tissue: Scroll,
  request_cutlery: Utensils,
  request_menu: BookOpen,
  request_cleaning: Brush,
  request_ac: Snowflake,
  request_music: Music2,
  request_assistance: Lightbulb,
};
