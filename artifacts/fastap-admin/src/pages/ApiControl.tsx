import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Trash2, Key, Loader2, Webhook, BarChart3, RotateCcw } from "lucide-react";
import { api, type ApiKey } from "@/lib/apiClient";
import { toast } from "sonner";
import { KpiCard } from "@/components/shared/KpiCard";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const defaultForm = { name: "", environment: "Production" };

export default function ApiControl() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [webhookDialog, setWebhookDialog] = useState(false);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [webhookUrl, setWebhookUrl] = useState("");

  const { data: keys = [], isLoading } = useQuery({ queryKey: ["api-keys"], queryFn: api.apiKeys.list });
  const { data: webhooks = [], isLoading: whLoading } = useQuery({ queryKey: ["webhooks"], queryFn: api.webhooks.list });
  const { data: usage } = useQuery({ queryKey: ["api-usage"], queryFn: api.apiUsage.get, refetchInterval: 60_000 });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; environment: string }) => api.apiKeys.create(data),
    onSuccess: (k) => { setNewKey(k); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
    onError: () => toast.error("Failed to generate key"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.apiKeys.delete(id),
    onSuccess: () => { toast.success("API key revoked"); qc.invalidateQueries({ queryKey: ["api-keys"] }); },
  });

  const createWebhookMutation = useMutation({
    mutationFn: () => api.webhooks.create({ url: webhookUrl }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); setWebhookDialog(false); setWebhookUrl(""); toast.success("Webhook added"); },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => api.webhooks.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Webhook removed"); },
  });

  const retryWebhookMutation = useMutation({
    mutationFn: (id: string) => api.webhooks.retry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Webhook retry sent"); },
  });

  const formatTime = (s: string | null) => {
    if (!s) return "Never";
    const diff = Date.now() - new Date(s).getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">API & Integration Control</h2><p className="text-muted-foreground">API keys, webhooks, and usage analytics.</p></div>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys"><Key className="h-4 w-4 mr-1" /> API Keys</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1" /> Webhooks</TabsTrigger>
          <TabsTrigger value="usage"><BarChart3 className="h-4 w-4 mr-1" /> Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div className="grid gap-4 md:grid-cols-3 flex-1 mr-4">
              <KpiCard title="Active Keys" value={keys.filter(k => k.status === "Active").length} icon={<Key className="h-4 w-4 text-green-500" />} />
              <KpiCard title="Production" value={keys.filter(k => k.environment === "Production").length} icon={<Key className="h-4 w-4 text-primary" />} />
              <KpiCard title="Sandbox" value={keys.filter(k => k.environment === "Sandbox").length} icon={<Key className="h-4 w-4 text-muted-foreground" />} />
            </div>
            <Button onClick={() => { setDialog(true); setNewKey(null); setForm(defaultForm); }}><Plus className="mr-2 h-4 w-4" /> Generate Key</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                <DataTable data={keys} columns={[
                  { header: "Name", cell: (row: ApiKey) => <span className="font-medium">{row.name}</span> },
                  { header: "Environment", cell: (row: ApiKey) => <Badge variant={row.environment === "Production" ? "default" : "secondary"} className="text-xs">{row.environment}</Badge> },
                  { header: "Prefix", cell: (row: ApiKey) => <span className="font-mono text-xs">{row.prefix}...</span> },
                  { header: "Last Used", cell: (row: ApiKey) => <span className="text-xs text-muted-foreground">{formatTime(row.lastUsed)}</span> },
                  { header: "Status", cell: (row: ApiKey) => <StatusBadge status={row.status} /> },
                  { header: "", cell: (row: ApiKey) => (
                    <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => { if (confirm(`Revoke "${row.name}"?`)) deleteMutation.mutate(row.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setWebhookDialog(true)}><Plus className="mr-2 h-4 w-4" /> Add Webhook</Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {whLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : webhooks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No webhooks configured.</p>
              ) : (
                <DataTable data={webhooks} columns={[
                  { header: "URL", cell: (row: any) => <span className="font-mono text-xs truncate max-w-[200px] block">{row.url}</span> },
                  { header: "Events", cell: (row: any) => <span className="text-xs">{(row.events || []).join(", ")}</span> },
                  { header: "Failures", cell: (row: any) => <span className={row.failures > 0 ? "text-red-500" : ""}>{row.failures ?? 0}</span> },
                  { header: "Status", cell: (row: any) => <StatusBadge status={row.status} /> },
                  { header: "", cell: (row: any) => (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => retryWebhookMutation.mutate(row.id)}><RotateCcw className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteWebhookMutation.mutate(row.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard title="Total API Calls" value={usage?.totalCalls?.toLocaleString() ?? "—"} icon={<BarChart3 className="h-4 w-4" />} />
            <KpiCard title="Success Rate" value={`${usage?.successRate ?? 0}%`} icon={<BarChart3 className="h-4 w-4 text-green-500" />} />
            <KpiCard title="Avg Response" value={`${usage?.avgResponseMs ?? 0}ms`} icon={<BarChart3 className="h-4 w-4" />} />
            <KpiCard title="Failed Calls" value={String(usage?.failedCalls ?? 0)} icon={<BarChart3 className="h-4 w-4 text-red-500" />} />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Calls by Hour (24h)</CardTitle></CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage?.hourly ?? []}><XAxis dataKey="hour" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="calls" fill="hsl(var(--primary))" radius={2} /></BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Top Endpoints</CardTitle></CardHeader>
            <CardContent>
              <DataTable data={usage?.endpoints ?? []} columns={[
                { header: "Endpoint", accessorKey: "path" },
                { header: "Calls", accessorKey: "calls" },
                { header: "Errors", accessorKey: "errors" },
                { header: "Avg ms", accessorKey: "avgMs" },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate API Key</DialogTitle></DialogHeader>
          {!newKey ? (
            <div className="space-y-3 py-2">
              <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <Button className="w-full" disabled={!form.name || createMutation.isPending} onClick={() => createMutation.mutate(form)}>Generate</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Copy this key now — it won&apos;t be shown again.</p>
              <div className="flex gap-2">
                <Input readOnly value={newKey.fullKey || ""} className="font-mono text-xs" />
                <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(newKey.fullKey || ""); toast.success("Copied!"); }}><Copy className="h-4 w-4" /></Button>
              </div>
              <Button className="w-full" onClick={() => setDialog(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={webhookDialog} onOpenChange={setWebhookDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Webhook</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Callback URL</Label>
            <Input placeholder="https://your-server.com/webhooks/fastap" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
          </div>
          <DialogFooter>
            <Button disabled={!webhookUrl || createWebhookMutation.isPending} onClick={() => createWebhookMutation.mutate()}>Add Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
