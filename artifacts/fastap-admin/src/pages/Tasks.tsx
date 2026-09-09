import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Clock, Plus, RefreshCw, Loader2, Search, CheckCircle, AlertTriangle, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/Page";

// The API stores task status lowercase ("pending", "in progress"); a few older rows and
// the create response use title case. Every comparison goes through this so both match.
const norm = (s?: string) => String(s ?? "").toLowerCase().replace(/_/g, " ").trim();
const statusLabel = (s?: string) => {
  const n = norm(s);
  return n ? n.replace(/\b\w/g, c => c.toUpperCase()) : "Pending";
};

export default function Tasks() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", type: "Vendor Verification", priority: "medium", assignedTo: "", dueDate: "", description: "" });

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["tasks"],
    queryFn: api.tasks.list,
  });

  const createMutation = useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setOpen(false); toast({ title: "Task created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.tasks.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast({ title: "Task updated" }); },
    onError: (e: any) => toast({ title: "Could not update task", description: e.message, variant: "destructive" }),
  });

  const filtered = tasks.filter((t: any) => {
    const matchSearch = t.title?.toLowerCase().includes(search.toLowerCase()) || t.assignedTo?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || norm(t.status) === filter;
    return matchSearch && matchFilter;
  });

  const pending = tasks.filter((t: any) => norm(t.status) === "pending").length;
  const inProgress = tasks.filter((t: any) => norm(t.status) === "in progress").length;
  const completed = tasks.filter((t: any) => norm(t.status) === "completed").length;

  const priorityColor: Record<string, string> = {
    critical: "text-danger bg-danger-subtle",
    high: "text-warning bg-warning-subtle",
    medium: "text-warning bg-warning-subtle",
    low: "text-info bg-info-subtle",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internal Task Management"
        description="Track vendor verification, compliance reviews, refund reviews, and technical tasks."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Task</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Create New Task</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 pt-2">
            <div className="space-y-2">
            <Label>Task Title</Label>
            <Input placeholder="Task title..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
            {["Vendor Verification", "Compliance Review", "Refund Review", "Technical Review", "KYC Review", "Settlement Review", "Fraud Investigation"].map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
            </SelectContent>
            </Select>
            </div>
            <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            </SelectContent>
            </Select>
            </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
            <Label>Assigned To</Label>
            <Input placeholder="Agent name" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} />
            </div>
            <div className="space-y-2">
            <Label>Due Date</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            </div>
            <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Task details..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Task
            </Button>
            </form>
            </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Tasks" value={tasks.length} icon={<CheckSquare className="h-4 w-4 text-primary" />} />
        <KpiCard title="Pending" value={pending} icon={<Clock className="h-4 w-4 text-warning" />} />
        <KpiCard title="In Progress" value={inProgress} icon={<PlayCircle className="h-4 w-4 text-info" />} />
        <KpiCard title="Completed" value={completed} icon={<CheckCircle className="h-4 w-4 text-success" />} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tasks…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <DataTable data={filtered} pageSize={10} columns={[
              { header: "Title", cell: (row: any) => <span className="font-medium">{row.title}</span> },
              { header: "Type", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.type}</span> },
              { header: "Priority", cell: (row: any) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColor[row.priority?.toLowerCase()] || "bg-muted text-muted-foreground"}`}>{row.priority}</span>
              )},
              { header: "Assigned To", cell: (row: any) => <span className="text-sm">{row.assignedTo || "Unassigned"}</span> },
              { header: "Due Date", cell: (row: any) => (
                <span className={`text-xs ${row.dueDate && new Date(row.dueDate) < new Date() && norm(row.status) !== "completed" ? "text-danger font-medium" : "text-muted-foreground"}`}>{row.dueDate || "No deadline"}</span>
              )},
              { header: "Status", cell: (row: any) => (
                <Badge variant={norm(row.status) === "completed" ? "default" : norm(row.status) === "in progress" ? "secondary" : "outline"} className="text-xs">{statusLabel(row.status)}</Badge>
              )},
              { header: "Actions", cell: (row: any) => (
                <div className="flex gap-1">
                  {norm(row.status) === "pending" && <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: row.id, status: "in progress" })}>Start</Button>}
                  {norm(row.status) === "in progress" && <Button variant="ghost" size="sm" className="h-7 text-xs text-success" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: row.id, status: "completed" })}>Done</Button>}
                  {norm(row.status) === "completed" && <span className="text-xs text-muted-foreground">Done</span>}
                </div>
              )},
            ]} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
