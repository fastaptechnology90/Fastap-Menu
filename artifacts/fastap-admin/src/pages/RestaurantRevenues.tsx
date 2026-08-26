import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { Building2, IndianRupee, Loader2, TrendingUp } from "lucide-react";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><TrendingUp className="h-6 w-6" /> Restaurant Revenues</h2>
        <p className="text-muted-foreground">Total revenue collected per restaurant (orders + spa), highest first.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" /> Platform grand total</p>
          <p className="text-3xl font-extrabold mt-1">{fmtINRFull(grandTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Restaurants</p>
          <p className="text-3xl font-extrabold mt-1">{data?.count ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <p className="text-xs text-muted-foreground">Top earner</p>
          <p className="text-lg font-bold mt-1 truncate">{all[0]?.name ?? "—"}</p>
          <p className="text-sm text-emerald-500 font-semibold">{all[0] ? fmtINRFull(all[0].totalRevenue) : ""}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base">All restaurants</CardTitle>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="accent-primary" /> Hide ₹0
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search restaurant name…" className="rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-72" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No restaurants{q ? ` matching "${search}"` : ""}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground text-left">
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">Restaurant</th>
                    <th className="py-2 pr-4 font-medium text-right">Orders revenue</th>
                    <th className="py-2 pr-4 font-medium text-right">Spa revenue</th>
                    <th className="py-2 pr-4 font-medium text-right">Total revenue</th>
                    <th className="py-2 pr-4 font-medium text-right">Paid orders</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="py-3 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-3 pr-4 font-semibold">{r.name}</td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">{fmtINRFull(r.orderRevenue)}</td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">{fmtINRFull(r.spaRevenue)}</td>
                      <td className="py-3 pr-4 text-right font-bold text-emerald-500">{fmtINRFull(r.totalRevenue)}</td>
                      <td className="py-3 pr-4 text-right">{r.paidOrders}</td>
                      <td className="py-3"><Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Inactive"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="py-3 pr-4" colSpan={4}>Grand total</td>
                    <td className="py-3 pr-4 text-right text-emerald-500">{fmtINRFull(grandTotal)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
