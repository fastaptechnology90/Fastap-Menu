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
import { Mail, MessageSquare, Phone, Send, RefreshCw, Loader2, Megaphone, Radio, PhoneCall, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/Page";

// The log returns status lowercase ("delivered"); the send response uses title case.
const norm = (s?: string) => String(s ?? "").toLowerCase().trim();
const pretty = (s?: string) => {
  const n = norm(s);
  return n ? n.replace(/\b\w/g, c => c.toUpperCase()) : "—";
};

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
      toast({ title: "Communication recorded", description: "Saved to the log. No message has been dispatched — see the notice on this page." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const emailsSent = comms.filter((c: any) => norm(c.channel) === "email").length;
  const smsSent = comms.filter((c: any) => norm(c.channel) === "sms").length;
  const whatsappSent = comms.filter((c: any) => norm(c.channel) === "whatsapp").length;
  const callLogs = comms.filter((c: any) => norm(c.channel) === "call").length;

  const typeColor: Record<string, string> = {
    Broadcast: "bg-info-subtle text-info",
    "Renewal Reminder": "bg-warning-subtle text-warning",
    "Downtime Alert": "bg-danger-subtle text-danger",
    "Maintenance Notice": "bg-warning-subtle text-warning",
    "Marketing Campaign": "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Communication Center"
        description="Draft and record broadcasts, renewal reminders, and marketing campaigns."
        actions={
          <>
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
            <p className="text-xs text-muted-foreground">
            This saves the message against the chosen audience. It is not dispatched — no provider is connected yet.
            </p>
            <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
            {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Record for {form.target === "all" ? "all vendors" : form.target}
            </Button>
            </form>
            </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="border-warning-border bg-warning-subtle">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Messages are recorded here, not delivered.</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              No email, SMS or WhatsApp provider is connected to this screen yet, so nothing reaches a vendor inbox.
              Each entry below is a draft kept on record with the audience it was aimed at.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Email Drafts" value={emailsSent} icon={<Mail className="h-4 w-4 text-info" />} />
        <KpiCard title="SMS Drafts" value={smsSent} icon={<Phone className="h-4 w-4 text-warning" />} />
        <KpiCard title="WhatsApp Drafts" value={whatsappSent} icon={<MessageSquare className="h-4 w-4 text-success" />} />
        <KpiCard title="Call Logs" value={callLogs} icon={<PhoneCall className="h-4 w-4 text-muted-foreground" />} />
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
                  { header: "Est. audience", cell: (row: any) => <span className="font-medium">{row.recipients?.toLocaleString() || "—"}</span> },
                  { header: "Created", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.sentAt).toLocaleString()}</span> },
                  { header: "Status", cell: (row: any) => (
                    <Badge variant="secondary" className="text-xs" title="Recorded on the platform. Not dispatched to any provider.">Recorded</Badge>
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
                      { header: "Est. audience", cell: (row: any) => <span>{row.recipients?.toLocaleString()}</span> },
                      { header: "Status", cell: (row: any) => <Badge variant="secondary" className="text-xs">{pretty(row.status)}</Badge> },
                      { header: "Created", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.sentAt).toLocaleDateString()}</span> },
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
