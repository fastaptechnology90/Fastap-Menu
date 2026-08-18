import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/shared/KpiCard";
import { api } from "@/lib/apiClient";
import { fmtINRFull } from "@/lib/format";
import { CalendarDays, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ReservationsControl() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: reservations = [], isLoading, refetch, isFetching } = useQuery({ queryKey: ["platform-reservations"], queryFn: api.reservations.list, refetchInterval: 60000 });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.reservations.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-reservations"] }); toast.success("Reservation updated"); },
    onError: () => toast.error("Update failed"),
  });

  const filtered = reservations.filter((r: any) =>
    r.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    r.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    r.id?.toLowerCase().includes(search.toLowerCase()),
  );

  const pending = reservations.filter((r: any) => r.status === "pending").length;

  return (
    <PageShell
      title="Reservations Control"
      description="Platform-wide reservation monitoring, deposit tracking, and override controls."
      icon={<CalendarDays className="h-6 w-6" />}
      accent="primary"
      badge={`${pending} pending`}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
    >
      <KpiCard title="Total Reservations" value={reservations.length} accent="primary" subtitle={`${pending} awaiting confirmation`} />
      <PanelCard
        title="All Reservations"
        action={
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search…" className="pl-8 h-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        }
      >
        <div className="admin-data-table-wrap">
          <DataTable data={filtered} columns={[
            { header: "ID", cell: (row: any) => <span className="font-mono text-xs text-primary">{row.id}</span> },
            { header: "Vendor", accessorKey: "vendorName" },
            { header: "Customer", cell: (row: any) => <div><p className="text-sm font-medium">{row.customerName}</p><p className="text-xs text-muted-foreground">{row.customerPhone}</p></div> },
            { header: "Date/Time", cell: (row: any) => <span className="text-xs">{row.date} · {row.time}</span> },
            { header: "Guests", accessorKey: "guests" },
            { header: "Deposit", cell: (row: any) => fmtINRFull(row.deposit) },
            { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
            { header: "Actions", cell: (row: any) => (
              <div className="flex gap-1">
                {row.status !== "confirmed" && <Button size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: row.id, status: "confirmed" })}>Confirm</Button>}
                {row.status !== "cancelled" && <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-500" onClick={() => updateMutation.mutate({ id: row.id, status: "cancelled" })}>Cancel</Button>}
              </div>
            )},
          ]} />
        </div>
      </PanelCard>
    </PageShell>
  );
}
