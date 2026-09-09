import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { KpiCard } from "@/components/shared/KpiCard";
import { MessageSquare, Clock, ArrowUpRight, CheckCircle2, Search, Loader2, UserPlus, GitMerge } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type SupportTicket } from "@/lib/apiClient";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/Page";

// Ticket status/priority come from the API lowercase ("open", "in_progress",
// "critical"). Compare through this rather than against title-case literals.
const norm = (s?: string) => String(s ?? "").toLowerCase().replace(/_/g, " ").trim();
const pretty = (s?: string) => {
  const n = norm(s);
  return n ? n.replace(/\b\w/g, c => c.toUpperCase()) : "—";
};

export default function Support() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; id: string; subject: string }>({ open: false, id: "", subject: "" });
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; primaryId: string }>({ open: false, primaryId: "" });
  const [mergeSecondaryId, setMergeSecondaryId] = useState("");
  const [resolution, setResolution] = useState("");

  const { data: tickets = [], isLoading } = useQuery({ queryKey: ["support"], queryFn: api.support.list, refetchInterval: 30000 });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) => api.support.resolve(id, resolution),
    onSuccess: () => { toast.success("Ticket resolved"); setResolveDialog({ open: false, id: "", subject: "" }); setResolution(""); qc.invalidateQueries({ queryKey: ["support"] }); },
    onError: () => toast.error("Failed to resolve ticket"),
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => api.support.escalate(id),
    onSuccess: (_, id) => { toast.warning(`Ticket ${id} escalated`); qc.invalidateQueries({ queryKey: ["support"] }); },
    onError: () => toast.error("Failed to escalate"),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.support.close(id),
    onSuccess: (_, id) => { toast.success(`Ticket ${id} closed`); qc.invalidateQueries({ queryKey: ["support"] }); },
    onError: () => toast.error("Failed to close"),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, agent }: { id: string; agent: string }) => api.support.assign(id, agent),
    onSuccess: () => { toast.success("Ticket assigned"); qc.invalidateQueries({ queryKey: ["support"] }); },
    onError: () => toast.error("Assign failed"),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ primaryId, secondaryId }: { primaryId: string; secondaryId: string }) => api.support.merge(primaryId, secondaryId),
    onSuccess: () => { toast.success("Tickets merged"); setMergeDialog({ open: false, primaryId: "" }); setMergeSecondaryId(""); qc.invalidateQueries({ queryKey: ["support"] }); },
    onError: () => toast.error("Merge failed"),
  });

  const getPriorityColor = (p: string) => { const n = norm(p); return n === "critical" ? "bg-danger-subtle text-danger" : n === "high" ? "bg-warning-subtle text-warning" : n === "medium" ? "bg-warning-subtle text-warning" : "bg-info-subtle text-info"; };

  const filtered = tickets.filter(t => t.vendorName.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Tickets"
        description="Vendor support requests and SLA monitoring."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Open Tickets" value={tickets.filter(t => norm(t.status) === "open").length} icon={<MessageSquare className="h-4 w-4 text-primary" />} />
        <KpiCard title="Critical" value={tickets.filter(t => norm(t.priority) === "critical").length} icon={<Clock className="h-4 w-4 text-danger" />} />
        <KpiCard title="Escalated" value={tickets.filter(t => norm(t.status) === "escalated").length} icon={<ArrowUpRight className="h-4 w-4 text-warning" />} />
        <KpiCard title="Resolved" value={tickets.filter(t => norm(t.status) === "resolved").length} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search tickets..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <DataTable
              data={filtered}
              emptyMessage="No support tickets"
              emptyDescription="Venues have no way to raise a ticket from their panel yet, so this queue stays empty."
              columns={[
              { header: "Ticket ID", cell: (row: SupportTicket) => <span className="font-mono text-xs">{row.id}</span> },
              { header: "Vendor", accessorKey: "vendorName" },
              { header: "Subject", cell: (row: SupportTicket) => <span className="text-sm">{row.subject}</span> },
              { header: "Priority", cell: (row: SupportTicket) => <Badge className={`text-xs ${getPriorityColor(row.priority)}`} variant="outline">{pretty(row.priority)}</Badge> },
              { header: "Status", cell: (row: SupportTicket) => <StatusBadge status={pretty(row.status)} /> },
              { header: "SLA Deadline", cell: (row: SupportTicket) => { const d = new Date(row.slaDeadline); const overdue = d < new Date(); return <span className={`text-xs ${overdue ? "text-danger font-medium" : "text-muted-foreground"}`}>{d.toLocaleDateString()}</span>; } },
              { header: "Actions", cell: (row: SupportTicket) => (
                <div className="flex items-center gap-1 flex-wrap">
                  <Select onValueChange={agent => assignMutation.mutate({ id: row.id, agent })}>
                    <SelectTrigger className="h-7 w-[100px] text-xs"><UserPlus className="h-3 w-3 mr-1" /><SelectValue placeholder="Assign" /></SelectTrigger>
                    <SelectContent>
                      {["Agent A", "Agent B", "Finance Team", "Tech Lead"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-success" disabled={norm(row.status) === "resolved" || norm(row.status) === "closed"} onClick={() => { setResolveDialog({ open: true, id: row.id, subject: row.subject }); setResolution(""); }}>Resolve</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs text-warning" disabled={norm(row.status) === "escalated" || norm(row.status) === "closed"} onClick={() => escalateMutation.mutate(row.id)}>Escalate</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={norm(row.status) === "closed"} onClick={() => closeMutation.mutate(row.id)}>Close</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setMergeDialog({ open: true, primaryId: row.id }); setMergeSecondaryId(""); }}><GitMerge className="h-3 w-3 mr-1" /> Merge</Button>
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
      <Dialog open={resolveDialog.open} onOpenChange={open => setResolveDialog({ open, id: "", subject: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve: {resolveDialog.subject}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Add a resolution note. The vendor will be notified.</p>
          <Textarea placeholder="Describe how the issue was resolved..." value={resolution} onChange={e => setResolution(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog({ open: false, id: "", subject: "" })}>Cancel</Button>
            <Button disabled={!resolution.trim() || resolveMutation.isPending} onClick={() => resolveMutation.mutate({ id: resolveDialog.id, resolution })}>
              {resolveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={mergeDialog.open} onOpenChange={open => setMergeDialog({ open, primaryId: "" })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Merge into {mergeDialog.primaryId}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Enter the secondary ticket ID to merge into this ticket.</p>
          <Input placeholder="TKT-123" value={mergeSecondaryId} onChange={e => setMergeSecondaryId(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog({ open: false, primaryId: "" })}>Cancel</Button>
            <Button disabled={!mergeSecondaryId.trim() || mergeMutation.isPending} onClick={() => mergeMutation.mutate({ primaryId: mergeDialog.primaryId, secondaryId: mergeSecondaryId })}>
              {mergeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Merge Tickets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
