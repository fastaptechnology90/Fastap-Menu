import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { KpiCard } from "@/components/shared/KpiCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, RefreshCw, Loader2, Trash2, AlertTriangle, Wrench, Zap, Radio } from "lucide-react";

export default function Announcements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", type: "Feature Release", severity: "info", scheduledAt: "", targetAudience: "all", active: true });

  const { data: announcements = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["announcements"],
    queryFn: api.announcements.list,
  });

  const createMutation = useMutation({
    mutationFn: api.announcements.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); setOpen(false); toast({ title: "Announcement published" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.announcements.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["announcements"] }); toast({ title: "Announcement removed" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: api.announcements.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const typeIcon: Record<string, React.ReactNode> = {
    "Maintenance Alert": <Wrench className="h-4 w-4" />,
    "Feature Release": <Zap className="h-4 w-4" />,
    "Downtime Notice": <AlertTriangle className="h-4 w-4" />,
    "Emergency Alert": <AlertTriangle className="h-4 w-4 text-red-400" />,
    "General Update": <Megaphone className="h-4 w-4" />,
  };

  const severityStyle: Record<string, string> = {
    info: "border-blue-500/30 bg-blue-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    critical: "border-red-500/30 bg-red-500/5",
    success: "border-green-500/30 bg-green-500/5",
  };

  const activeAnnouncements = announcements.filter((a: any) => a.active);
  const scheduledAnnouncements = announcements.filter((a: any) => a.scheduledAt && new Date(a.scheduledAt) > new Date());

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Announcement & Maintenance Broadcast</h2>
          <p className="text-muted-foreground">Publish maintenance alerts, feature releases, downtime notices, and emergency alerts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Radio className="mr-2 h-4 w-4" /> New Announcement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Maintenance Alert", "Feature Release", "Downtime Notice", "Emergency Alert", "General Update"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Severity</Label>
                    <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="Announcement title..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea placeholder="Announcement content..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={form.targetAudience} onValueChange={v => setForm(f => ({ ...f, targetAudience: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vendors</SelectItem>
                        <SelectItem value="active">Active Only</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Scheduled At (optional)</Label>
                    <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                  <Label>Publish immediately</Label>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                  Publish Announcement
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total" value={announcements.length} icon={<Megaphone className="h-4 w-4 text-primary" />} />
        <KpiCard title="Active" value={activeAnnouncements.length} icon={<Radio className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Scheduled" value={scheduledAnnouncements.length} icon={<Loader2 className="h-4 w-4 text-yellow-500" />} />
        <KpiCard title="Emergency" value={announcements.filter((a: any) => a.type === "Emergency Alert").length} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann: any) => (
            <Card key={ann.id} className={`border ${severityStyle[ann.severity] || ""}`}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-muted-foreground">{typeIcon[ann.type] || <Megaphone className="h-4 w-4" />}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{ann.title}</span>
                        <Badge variant={ann.severity === "critical" ? "destructive" : ann.severity === "warning" ? "outline" : "secondary"} className="text-xs capitalize">{ann.severity}</Badge>
                        <Badge variant="outline" className="text-xs">{ann.type}</Badge>
                        {ann.active && <Badge variant="default" className="text-xs">Live</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{ann.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Target: <span className="font-medium capitalize">{ann.targetAudience}</span></span>
                        <span>Published: <span className="font-medium">{new Date(ann.createdAt).toLocaleDateString()}</span></span>
                        {ann.scheduledAt && <span>Scheduled: <span className="font-medium">{new Date(ann.scheduledAt).toLocaleString()}</span></span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={ann.active} onCheckedChange={() => toggleMutation.mutate(ann.id)} disabled={toggleMutation.isPending} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(ann.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {announcements.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No announcements published yet.</CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
