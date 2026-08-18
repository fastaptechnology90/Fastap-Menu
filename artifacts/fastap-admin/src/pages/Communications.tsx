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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageSquare, Phone, Send, RefreshCw, Loader2, Megaphone, Users, Radio, PhoneCall } from "lucide-react";

export default function Communications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "Broadcast", channel: "email", subject: "", message: "", target: "all" });

  const { data: comms = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["communications"],
    queryFn: api.communications.list,
  });

  const sendMutation = useMutation({
    mutationFn: api.communications.send,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communications"] });
      setOpen(false);
      toast({ title: "Communication sent successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const emailsSent = comms.filter((c: any) => c.channel === "email").length;
  const smsSent = comms.filter((c: any) => c.channel === "sms").length;
  const whatsappSent = comms.filter((c: any) => c.channel === "whatsapp").length;
  const callLogs = comms.filter((c: any) => c.channel === "call").length;

  const typeColor: Record<string, string> = {
    Broadcast: "bg-blue-500/10 text-blue-400",
    "Renewal Reminder": "bg-yellow-500/10 text-yellow-400",
    "Downtime Alert": "bg-red-500/10 text-red-400",
    "Maintenance Notice": "bg-orange-500/10 text-orange-400",
    "Marketing Campaign": "bg-purple-500/10 text-purple-400",
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vendor Communication Center</h2>
          <p className="text-muted-foreground">Broadcast messages, renewal reminders, and marketing campaigns.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Megaphone className="mr-2 h-4 w-4" /> New Communication</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Send Communication</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); sendMutation.mutate(form); }} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Broadcast", "Renewal Reminder", "Downtime Alert", "Maintenance Notice", "Marketing Campaign"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="push">Push</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select value={form.target} onValueChange={v => setForm(f => ({ ...f, target: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      <SelectItem value="active">Active Vendors</SelectItem>
                      <SelectItem value="trial">Trial Vendors</SelectItem>
                      <SelectItem value="expiring">Expiring Subscriptions</SelectItem>
                      <SelectItem value="enterprise">Enterprise Only</SelectItem>
                      <SelectItem value="dormant">Dormant Vendors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input placeholder="Message subject..." value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea placeholder="Write your message..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} required />
                </div>
                <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
                  {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send to {form.target === "all" ? "All Vendors" : form.target}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Emails Sent" value={emailsSent} icon={<Mail className="h-4 w-4 text-blue-500" />} />
        <KpiCard title="SMS Sent" value={smsSent} icon={<Phone className="h-4 w-4 text-orange-500" />} />
        <KpiCard title="WhatsApp Sent" value={whatsappSent} icon={<MessageSquare className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Call Logs" value={callLogs} icon={<PhoneCall className="h-4 w-4 text-purple-500" />} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="renewal">Renewals</TabsTrigger>
          <TabsTrigger value="downtime">Downtime</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Communication Log</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <DataTable data={comms} pageSize={10} columns={[
                  { header: "Type", cell: (row: any) => (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor[row.type] || "bg-muted text-muted-foreground"}`}>{row.type}</span>
                  )},
                  { header: "Subject", cell: (row: any) => <span className="font-medium text-sm">{row.subject}</span> },
                  { header: "Channel", cell: (row: any) => (
                    <div className="flex items-center gap-1 text-xs capitalize">
                      {row.channel === "email" ? <Mail className="h-3.5 w-3.5" /> : row.channel === "sms" ? <Phone className="h-3.5 w-3.5" /> : row.channel === "whatsapp" ? <MessageSquare className="h-3.5 w-3.5" /> : <Radio className="h-3.5 w-3.5" />}
                      {row.channel}
                    </div>
                  )},
                  { header: "Target", cell: (row: any) => <Badge variant="outline" className="text-xs capitalize">{row.target}</Badge> },
                  { header: "Recipients", cell: (row: any) => <span className="font-medium">{row.recipients?.toLocaleString() || "—"}</span> },
                  { header: "Delivered", cell: (row: any) => (
                    <span className={`font-medium ${(row.deliveryRate || 0) > 90 ? "text-green-400" : "text-yellow-400"}`}>{row.deliveryRate || 0}%</span>
                  )},
                  { header: "Sent At", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.sentAt).toLocaleString()}</span> },
                  { header: "Status", cell: (row: any) => (
                    <Badge variant={row.status === "Delivered" ? "default" : row.status === "Failed" ? "destructive" : "secondary"} className="text-xs">{row.status}</Badge>
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {["broadcast", "renewal", "downtime", "marketing"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <DataTable
                    data={comms.filter((c: any) => {
                      if (tab === "broadcast") return c.type === "Broadcast";
                      if (tab === "renewal") return c.type === "Renewal Reminder";
                      if (tab === "downtime") return c.type === "Downtime Alert";
                      if (tab === "marketing") return c.type === "Marketing Campaign";
                      return true;
                    })}
                    pageSize={10}
                    columns={[
                      { header: "Subject", cell: (row: any) => <span className="font-medium">{row.subject}</span> },
                      { header: "Channel", accessorKey: "channel" },
                      { header: "Recipients", cell: (row: any) => <span>{row.recipients?.toLocaleString()}</span> },
                      { header: "Status", cell: (row: any) => <Badge variant="secondary" className="text-xs">{row.status}</Badge> },
                      { header: "Sent", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.sentAt).toLocaleDateString()}</span> },
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
