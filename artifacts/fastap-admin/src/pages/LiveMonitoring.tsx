import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { api } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { Activity, CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Payment-method chip — so you can tell how each payment came in (UPI / Cash / Gateway…).
function PayMode({ mode }: { mode?: string }) {
  if (!mode) return null;
  const m = mode.toLowerCase();
  const label = m === "upi" ? "UPI" : m === "cash" ? "Cash" : m === "card" ? "Card"
    : (m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "Gateway"
    : m === "aggregator" ? "Aggregator" : m === "wallet" ? "Wallet"
    : (m === "room_bill" || m === "room") ? "Room Bill" : m === "netbanking" ? "Netbanking" : mode;
  const cls = m === "upi" ? "bg-success-subtle text-success"
    : m === "cash" ? "bg-warning-subtle text-warning"
    : m === "card" ? "bg-info-subtle text-info"
    : (m.includes("gateway") || m.includes("online") || m.includes("razor")) ? "bg-muted text-muted-foreground"
    : m === "aggregator" ? "bg-muted text-muted-foreground"
    : (m === "room_bill" || m === "room") ? "bg-info-subtle text-info"
    : "bg-muted text-muted-foreground";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${cls}`}>{label}</span>;
}

function FeedSection({ title, items, render, onItemClick }: { title: string; items: any[]; render: (item: any) => React.ReactNode; onItemClick?: (item: any) => void }) {
  return (
    <PanelCard title={title} action={<Badge variant="secondary" className="text-xs">{items.length} live</Badge>}>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p> : items.map((item, i) => (
          <div
            key={i}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
            className={`flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors ${onItemClick ? "cursor-pointer" : ""}`}
          >
            {render(item)}
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

const PAY_LABEL: Record<string, string> = {
  upi: "UPI", card: "Card", cash: "Cash", wallet: "Wallet", nfc: "NFC",
  netbanking: "Net Banking", room_bill: "Room Bill", aggregator: "Aggregator", online: "Online",
};
function payLabel(mode?: string) {
  const m = String(mode ?? "").toLowerCase();
  return PAY_LABEL[m] ?? (mode ? String(mode).toUpperCase() : "—");
}

/** Detail popup for a live order / payment — shows exactly how it was paid. */
function LiveDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="py-2 text-center">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{fmtINRFull(item.amount)}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{item.id}</p>
            <div className="mt-2"><StatusBadge status={item.status} /></div>
          </div>
          {[
            ["Vendor / hotel", item.vendor],
            ["Payment method", payLabel(item.mode)],
            ["UPI ID", item.upiId || "—"],
            ["UTR / reference", item.reference || item.utr || "—"],
            ["Collected by", item.collectedBy || "—"],
            ["Collected from", item.collectedFrom || "—"],
            ["Customer", item.customerName || "—"],
            ["Table / room", item.tableName || item.roomNumber || "—"],
            ["Time", item.at ? new Date(item.at).toLocaleString("en-IN") : "—"],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between gap-3 border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="break-all text-right font-medium">{(v as string) ?? "—"}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function LiveMonitoring() {
  const [selected, setSelected] = useState<any | null>(null);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["live-feed"],
    queryFn: api.liveFeed.get,
    refetchInterval: 15_000,
  });

  const rel = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  return (
    <PageShell
      title="Live Monitoring"
      description="Real-time orders, payments, refunds, settlements, and support — auto-refreshes every 15s."
      icon={<Activity className="h-6 w-6" />}
      accent="cyan"
      badge={<span className="flex items-center gap-1.5 text-xs"><span className="admin-glow-dot" /> Live</span>}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Link href="/dashboard"><Button size="sm" variant="outline" className="rounded-xl">Dashboard</Button></Link>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FeedSection title="Live Orders" items={data?.orders ?? []} onItemClick={setSelected} render={o => (
          <>
            <div>
              <span className="font-mono text-xs text-primary">{o.id}</span>
              {o.vendor && <p className="text-xs font-medium text-foreground truncate max-w-[9rem]">{o.vendor}</p>}
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">{o.tableName ? `${o.tableName} · ` : ""}{rel(o.at)} <PayMode mode={o.mode} /></p>
            </div>
            <div className="text-right"><p className="font-semibold">{fmtINRFull(o.amount)}</p><StatusBadge status={o.status} /></div>
          </>
        )} />
        <FeedSection title="Live Payments" items={data?.payments ?? []} onItemClick={setSelected} render={p => (
          <>
            <div><span className="font-mono text-xs">{p.id}</span><p className="text-xs text-muted-foreground flex items-center gap-1.5">{p.vendor} <PayMode mode={p.mode} /></p></div>
            <div className="text-right"><p className="font-semibold text-success">{fmtINRFull(p.amount)}</p><StatusBadge status={p.status} /></div>
          </>
        )} />
        <FeedSection title="Live Refunds" items={data?.refunds ?? []} render={r => (
          <>
            <div><span className="text-xs">{r.vendor}</span><p className="text-xs text-muted-foreground">{rel(r.at)}</p></div>
            <div className="text-right"><p className="font-semibold text-danger">{fmtINRFull(r.amount)}</p></div>
          </>
        )} />
        <FeedSection title="Settlements" items={data?.settlements ?? []} render={s => (
          <>
            <div><span className="text-xs font-medium">{s.vendor}</span></div>
            <StatusBadge status={s.status} />
          </>
        )} />
        <FeedSection title="Support Tickets" items={data?.tickets ?? data?.support ?? []} render={t => (
          <>
            <div>
              <span className="font-mono text-xs">{t.id}</span>
              <p className="text-xs truncate max-w-[140px]">{t.subject}</p>
            </div>
            <Badge variant="outline" className="text-xs capitalize">{t.priority ?? t.status ?? "open"}</Badge>
          </>
        )} />
        <FeedSection title="Platform Activity" items={data?.activity ?? data?.system ?? []} render={a => (
          <>
            <div>
              <span className="text-xs font-medium">{a.action ?? a.event}</span>
              <p className="text-xs text-muted-foreground">{a.user ?? a.module ?? "system"}</p>
            </div>
            <span className="text-xs text-muted-foreground">{rel(a.at)}</span>
          </>
        )} />
      </div>

      {selected && <LiveDetailModal item={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}
