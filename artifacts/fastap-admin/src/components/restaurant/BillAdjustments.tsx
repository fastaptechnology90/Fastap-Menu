import { useCallback, useEffect, useState } from "react";
import { Ban, Gift, Loader2, RotateCcw, ScrollText, X } from "lucide-react";

import { orderAdjustments, type OrderAdjustment } from "@/lib/api";
import { fmtINRFull } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

/**
 * The corrections a bill needs during service, put where the bill is.
 *
 * The server refuses any of these without a reason, and rightly so — an adjustment with
 * no reason attached is indistinguishable from theft. So the reason field is on screen
 * the moment the action is chosen, on the line itself rather than behind another dialog,
 * and the confirm stays disabled until it is filled in.
 */

export type AdjustKind = "void" | "comp";

const KIND_COPY: Record<AdjustKind, { verb: string; placeholder: string; tone: string }> = {
  void: {
    verb: "Void",
    placeholder: "Why is this being voided? e.g. keyed twice",
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  },
  comp: {
    verb: "Comp",
    placeholder: "Why is this on the house? e.g. served cold",
    tone: "border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20",
  },
};

export function LineAdjustControls({
  onAdjust,
  disabled,
  disabledHint,
  className = "",
}: {
  onAdjust: (kind: AdjustKind, reason: string) => Promise<unknown>;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
}) {
  const [kind, setKind] = useState<AdjustKind | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (disabled) {
    return disabledHint ? <p className={`text-[10px] text-white/25 ${className}`}>{disabledHint}</p> : null;
  }

  async function confirm() {
    if (!kind || !reason.trim() || busy) return;
    setBusy(true);
    try {
      await onAdjust(kind, reason.trim());
      setKind(null);
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  if (!kind) {
    return (
      <div className={`flex gap-1.5 ${className}`}>
        {(["void", "comp"] as const).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => { setKind(k); setReason(""); }}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-all ${KIND_COPY[k].tone}`}
          >
            {k === "void" ? <Ban className="h-3 w-3" /> : <Gift className="h-3 w-3" />}
            {KIND_COPY[k].verb}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <input
        autoFocus
        value={reason}
        onChange={e => setReason(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") setKind(null); }}
        placeholder={KIND_COPY[kind].placeholder}
        aria-label={`Reason to ${KIND_COPY[kind].verb.toLowerCase()} this line`}
        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] placeholder:text-white/25 focus:border-amber-500/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={confirm}
        disabled={!reason.trim() || busy}
        className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-all disabled:opacity-40 ${KIND_COPY[kind].tone}`}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        {KIND_COPY[kind].verb}
      </button>
      <button
        type="button"
        onClick={() => setKind(null)}
        aria-label="Cancel"
        className="shrink-0 rounded-lg p-1 text-white/30 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/** The struck-through line and its reason — what a voided or comped item must still show. */
export function AdjustedLineNote({
  voided,
  comped,
  reason,
  by,
}: {
  voided?: boolean;
  comped?: boolean;
  reason?: string;
  by?: string;
}) {
  if (!voided && !comped) return null;
  const label = voided ? "Voided" : "Comped";
  const tone = voided ? "text-rose-300" : "text-violet-300";
  return (
    <p className={`mt-0.5 text-[10px] ${tone}`}>
      {label}
      {reason ? ` — ${reason}` : ""}
      {by ? ` · ${by}` : ""}
    </p>
  );
}

/** Reason first, amount optional — leave the amount blank to return whatever is left. */
export function RefundControls({
  outstanding,
  onRefund,
  className = "",
}: {
  /** What is still refundable, shown so nobody has to work it out. */
  outstanding?: number;
  onRefund: (reason: string, amount?: number) => Promise<unknown>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason.trim() || busy) return;
    const parsed = amount.trim() ? Number(amount) : undefined;
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast({ title: "Enter a refund amount above zero", description: "Or leave it blank to refund the full balance.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await onRefund(reason.trim(), parsed);
      setOpen(false);
      setReason("");
      setAmount("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/25 py-2.5 text-sm font-semibold text-rose-300 transition-all hover:bg-rose-500/10 ${className}`}
      >
        <RotateCcw className="h-4 w-4" /> Refund this bill
      </button>
    );
  }

  return (
    <div className={`space-y-2 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-rose-200">Refund</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cancel refund" className="text-white/30 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        autoFocus
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Why is this being refunded?"
        aria-label="Refund reason"
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs placeholder:text-white/25 focus:border-amber-500/50 focus:outline-none"
      />
      <input
        value={amount}
        onChange={e => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder={outstanding != null ? `Amount — blank refunds all ${fmtINRFull(outstanding)}` : "Amount — blank refunds the balance"}
        aria-label="Refund amount"
        className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs placeholder:text-white/25 focus:border-amber-500/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!reason.trim() || busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-500/25 py-2 text-xs font-bold text-rose-100 transition-all hover:bg-rose-500/35 disabled:opacity-40"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm refund
      </button>
    </div>
  );
}

const KIND_STYLE: Record<string, string> = {
  void: "bg-rose-500/15 text-rose-300",
  comp: "bg-violet-500/15 text-violet-300",
  refund: "bg-amber-500/15 text-amber-300",
};

/**
 * What was changed on this bill and by whom. Rendered from the order's own history so a
 * manager reviewing a short till has the trail without leaving the order.
 */
export function AdjustmentHistory({
  restaurantId,
  orderId,
  refreshKey = 0,
}: {
  restaurantId: number | null;
  orderId: number | null;
  /** Bump after an adjustment to pull the list again. */
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<OrderAdjustment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!restaurantId || !orderId) { setRows([]); return; }
    setLoading(true);
    orderAdjustments.history(restaurantId, orderId)
      .then(res => { setRows(res.adjustments ?? []); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load the adjustment history."))
      .finally(() => setLoading(false));
  }, [restaurantId, orderId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading && rows.length === 0) {
    return <p className="text-xs text-white/30">Loading adjustments…</p>;
  }
  if (error) {
    return (
      <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5">
        <p className="text-[11px] text-rose-200">{error}</p>
        <button type="button" onClick={load} className="shrink-0 rounded-lg bg-rose-500/20 px-2 py-1 text-[10px] font-semibold text-rose-100">
          Retry
        </button>
      </div>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40">
        <ScrollText className="h-3.5 w-3.5" /> Adjustments
      </p>
      <ul className="space-y-1.5">
        {rows.map((a, i) => (
          <li key={`${a.at}-${i}`} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${KIND_STYLE[a.type] ?? "bg-white/10 text-white/50"}`}>
                {a.type}
              </span>
              <span className="text-xs font-semibold text-white/70">{fmtINRFull(a.amount)}</span>
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {a.item ? `${a.item} — ` : ""}{a.reason}
            </p>
            <p className="text-[10px] text-white/30">
              {a.by} · {new Date(a.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
