import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { Search, Store, CreditCard, Ticket, FileText, Undo2 } from "lucide-react";
import { fmtINRFull } from "@/lib/format";

export default function MasterSearch() {
  const [location] = useLocation();
  const initialQ = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : "";
  const [q, setQ] = useState(initialQ);
  const [submitted, setSubmitted] = useState(initialQ);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQ = params.get("q") ?? "";
    if (urlQ && urlQ !== submitted) {
      setQ(urlQ);
      setSubmitted(urlQ);
    }
  }, [location]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["master-search", submitted],
    queryFn: () => api.search.query(submitted),
    enabled: submitted.length >= 2,
  });

  const total = data ? data.vendors.length + data.payments.length + data.refunds.length + data.tickets.length + data.logs.length : 0;

  const sections = [
    { key: "vendors", title: "Vendors", icon: Store, items: data?.vendors ?? [], render: (v: any) => (
      <Link href={`/vendors/${v.id}`} className="flex justify-between items-center text-sm hover:bg-primary/5 p-3 rounded-xl transition-colors border border-transparent hover:border-primary/20">
        <span className="font-semibold">{v.name}</span>
        <Badge variant="outline" className="capitalize text-xs">{v.plan}</Badge>
      </Link>
    )},
    { key: "payments", title: "Payments", icon: CreditCard, items: data?.payments ?? [], render: (p: any) => (
      <Link href="/payments" className="flex justify-between text-sm p-3 rounded-xl hover:bg-muted/50">
        <span className="font-mono text-xs">{p.id}</span>
        <span className="text-muted-foreground">{p.vendorName}</span>
      </Link>
    )},
    { key: "refunds", title: "Refunds", icon: Undo2, items: data?.refunds ?? [], render: (r: any) => (
      <Link href="/refunds" className="flex justify-between items-center text-sm p-3 rounded-xl hover:bg-muted/50">
        <span className="font-mono text-xs">{r.id}</span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">{fmtINRFull(r.amount)}</span>
          <Badge variant="outline" className="capitalize text-xs">{r.status}</Badge>
        </span>
      </Link>
    )},
    { key: "tickets", title: "Tickets", icon: Ticket, items: data?.tickets ?? [], render: (t: any) => (
      <Link href="/support" className="block text-sm p-3 rounded-xl hover:bg-muted/50">
        <span className="font-mono text-xs text-primary">{t.id}</span>
        <p className="text-muted-foreground truncate mt-0.5">{t.subject}</p>
      </Link>
    )},
    { key: "logs", title: "Audit Logs", icon: FileText, items: data?.logs ?? [], render: (l: any) => (
      <div className="text-sm p-3 rounded-xl bg-muted/30">
        <span className="font-medium">{l.action}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{l.module} · {l.user}</p>
      </div>
    )},
  ];

  return (
    <PageShell
      title="Master Search"
      description="Unified search across vendors, payments, refunds, tickets, and audit logs."
      icon={<Search className="h-6 w-6" />}
      accent="primary"
      badge={submitted && data ? `${total} results` : undefined}
      loading={isLoading && !!submitted}
    >
      <form
        className="flex gap-2 max-w-2xl"
        onSubmit={e => { e.preventDefault(); setSubmitted(q.trim()); }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-xl bg-muted/40" placeholder="Vendor name, TXN ID, ticket subject…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Button type="submit" className="rounded-xl h-11 px-6" disabled={q.trim().length < 2 || isFetching}>Search</Button>
      </form>

      {submitted && data && !isFetching && total === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No results for &quot;{submitted}&quot;</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {sections.filter(s => s.items.length > 0).map(({ key, title, icon: Icon, items, render }) => (
          <PanelCard key={key} title={title} action={<Badge variant="secondary">{items.length}</Badge>}>
            <div className="space-y-1 max-h-64 overflow-y-auto">{items.map((item: any, i: number) => <div key={i}>{render(item)}</div>)}</div>
          </PanelCard>
        ))}
      </div>
    </PageShell>
  );
}
