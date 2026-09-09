import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableShell } from "@/components/shared/TableShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { Building2, IndianRupee, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/Page";

export default function RestaurantRevenues() {
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(true);
  const { data, isLoading } = useQuery({ queryKey: ["restaurant-revenues"], queryFn: api.dashboard.restaurantRevenues, refetchInterval: 60_000 });

  const all = data?.restaurants ?? [];
  const q = search.trim().toLowerCase();
  const rows = all
    .filter(r => !q || r.name.toLowerCase().includes(q))
    .filter(r => !hideZero || r.totalRevenue > 0);
  const grandTotal = data?.grandTotal ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Takings by venue"
        // The description used to read "orders + spa" while the table and the grand
        // total also carried event advances — a third of the figure was unaccounted for.
        description="What each venue took across orders, spa and event advances, highest first. This is the venues' money, not the platform's."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><IndianRupee className="h-3.5 w-3.5" /> Platform grand total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{fmtINRFull(grandTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> Venues</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{data?.count ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Top earner</p>
          <p className="mt-1 truncate text-base font-medium">{all[0]?.name ?? "—"}</p>
          <p className="text-sm tabular-nums text-muted-foreground">{all[0] ? fmtINRFull(all[0].totalRevenue) : ""}</p>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <TableShell
          header={
            <>
              <p className="text-sm font-semibold">All venues</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={hideZero} onCheckedChange={v => setHideZero(v === true)} /> Hide ₹0
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search venue name"
                    aria-label="Search venues by name"
                    className="h-9 w-full pl-9 sm:w-64"
                  />
                </div>
              </div>
            </>
          }
        >
          {rows.length === 0 ? (
            q
              ? <EmptyState tone="search" title="No matching venues" description={`Nothing matches "${search}".`} />
              : <EmptyState title="No venues with takings" description="Untick “Hide ₹0” to see venues that have not traded yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Spa</TableHead>
                  <TableHead className="text-right">Event advances</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid orders</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtINRFull(r.orderRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtINRFull(r.spaRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtINRFull(r.banquetRevenue ?? 0)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmtINRFull(r.totalRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.paidOrders}</TableCell>
                    <TableCell><Badge variant={r.isActive ? "success" : "muted"}>{r.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 hover:bg-transparent">
                  <TableCell colSpan={5} className="font-medium">Grand total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmtINRFull(grandTotal)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TableShell>
      )}
    </div>
  );
}
