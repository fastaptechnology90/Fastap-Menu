import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, MessageSquare, Phone, Plus, RefreshCw, Trash2, Loader2, Send, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  push: <Bell className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  sms: <Phone className="h-3.5 w-3.5" />,
  whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
};

const channelColor: Record<string, string> = {
  push: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  email: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  sms: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  whatsapp: "bg-green-500/10 text-green-400 border-green-500/20",
};

export default function Notifications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", type: "Failed Payment", channel: "email", priority: "medium" });

  const { data: notifications = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications.list,
  });

  const createMutation = useMutation({
    mutationFn: api.notifications.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setOpen(false);
      toast({ title: "Notification sent successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.notifications.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Notification deleted" });
    },
  });

  const alertTypes = ["Failed Payment", "Refund Request", "Settlement Due", "Expiring Subscription", "Fraud Alert", "KYC Rejected", "Server Alert", "General"];
  const channels = ["email", "sms", "push", "whatsapp"];

  const activeAlerts = notifications.filter((n: any) => n.status === "Active" || n.status === "Sent").length;
  const failedCount = notifications.filter((n: any) => n.status === "Failed").length;

  const alertTypeConfig = [
    { type: "Failed Payment", channel: "email", enabled: true },
    { type: "Refund Request", channel: "push", enabled: true },
    { type: "Settlement Due", channel: "email", enabled: true },
    { type: "Expiring Subscription", channel: "sms", enabled: false },
    { type: "Fraud Alert", channel: "push", enabled: true },
    { type: "KYC Rejected", channel: "email", enabled: true },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notification Center</h2>
          <p className="text-muted-foreground">Manage platform alerts across all channels (Push, Email, SMS, WhatsApp).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Send className="mr-2 h-4 w-4" /> Send Notification</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Send New Notification</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Alert Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{alertTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="Notification title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea placeholder="Notification message..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{channels.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send Notification
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Sent" value={notifications.length} icon={<Bell className="h-4 w-4 text-primary" />} />
        <KpiCard title="Active / Sent" value={activeAlerts} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Failed" value={failedCount} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
        <KpiCard title="Pending" value={notifications.filter((n: any) => n.status === "Pending" || n.status === "Queued").length} icon={<Clock className="h-4 w-4 text-yellow-500" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {["push", "email", "sms", "whatsapp"].map(ch => (
          <Card key={ch}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium border ${channelColor[ch]}`}>
                  {CHANNEL_ICONS[ch]} <span className="capitalize">{ch}</span>
                </div>
                <span className="text-2xl font-bold">{notifications.filter((n: any) => n.channel === ch).length}</span>
              </div>
              <p className="text-xs text-muted-foreground">notifications via {ch}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Alert Type Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alertTypeConfig.map((cfg, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{cfg.type}</p>
                  <p className="text-xs text-muted-foreground capitalize">via {cfg.channel}</p>
                </div>
                <Switch defaultChecked={cfg.enabled} onCheckedChange={v => toast({ title: `${cfg.type} alerts ${v ? "enabled" : "disabled"}` })} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notification Log</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {notifications.slice(0, 10).map((n: any) => (
                  <div key={n.id} className="flex items-start justify-between p-3 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex items-center justify-center h-7 w-7 rounded-full border ${channelColor[n.channel] || "bg-muted"}`}>
                        {CHANNEL_ICONS[n.channel] || <Bell className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message?.slice(0, 60)}…</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(n.sentAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={n.status === "Failed" ? "destructive" : n.status === "Sent" ? "default" : "secondary"} className="text-[10px]">{n.status}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteMutation.mutate(n.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
