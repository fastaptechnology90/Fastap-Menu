import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { api } from "@/lib/apiClient";
import { AlertOctagon, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Incidents() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium" });

  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["incidents"], queryFn: api.incidents.list, refetchInterval: 30000 });
  const items = data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () => api.incidents.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incidents"] }); setOpen(false); setForm({ title: "", description: "", severity: "medium" }); toast.success("Incident created"); },
    onError: () => toast.error("Failed to create incident"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.incidents.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incidents"] }); toast.success("Incident updated"); },
  });

  const openCount = items.filter((i: any) => i.status === "open").length;

  return (
    <PageShell
      title="Incident Management"
      description="Track outages, degradations, and platform incidents with severity levels."
      icon={<AlertOctagon className="h-6 w-6" />}
      accent="rose"
      badge={openCount ? `${openCount} open` : undefined}
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Button onClick={() => setOpen(true)} className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> Report</Button>}
    >
      <div className="admin-stat-grid max-w-2xl">
        <KpiCard title="Open" value={openCount} accent="rose" icon={<AlertOctagon className="h-4 w-4 text-rose-500" />} />
        <KpiCard title="Resolved" value={items.filter((i: any) => i.status === "resolved").length} accent="emerald" />
      </div>
      <PanelCard title="Incident Log">
        <div className="admin-data-table-wrap">
          <DataTable data={items} columns={[
            { header: "ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
            { header: "Title", accessorKey: "title" },
            { header: "Severity", cell: (row: any) => <span className="capitalize text-xs font-medium">{row.severity}</span> },
            { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
            { header: "Created", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</span> },
            { header: "", cell: (row: any) => row.status === "open" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: row.id, status: "resolved" })}>Resolve</Button>
            )},
          ]} />
        </div>
      </PanelCard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
          <Input placeholder="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
