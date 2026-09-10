import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Activity, Server, Cpu, HardDrive, Network, RefreshCw, Loader2, AlertTriangle, CheckCircle, Clock, Download, Play, RotateCcw, Archive } from "lucide-react";
import { api, type InfraMetrics } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/Page";

function formatTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function formatUptimeSeconds(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function Infrastructure() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: metrics, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["metrics"],
    queryFn: api.metrics.get,
    refetchInterval: 15000,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["infrastructure-overview"],
    queryFn: api.infrastructure.overview,
    refetchInterval: 30000,
  });

  const { data: settings } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: api.settings.get,
  });

  const maintenanceMutation = useMutation({
    mutationFn: (enabled: boolean) => api.settings.update({ maintenanceMode: enabled }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
      toast({ title: enabled ? "Maintenance mode ON" : "Maintenance mode OFF" });
    },
    onError: () => toast({ title: "Failed to update maintenance mode", variant: "destructive" }),
  });

  // The endpoint writes a CSV of the vendor table into export history. It is not a
  // database backup, so it is not described as one.
  const backupMutation = useMutation({
    mutationFn: api.infrastructure.triggerBackup,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["infrastructure-overview"] });
      toast({ title: "Vendor snapshot created", description: `${data.id} — ${data.sizeMb} MB` });
    },
    onError: () => toast({ title: "Snapshot failed", variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: api.infrastructure.retryTasks,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["infrastructure-overview"] });
      toast({ title: `Retried ${data.retried} failed tasks` });
    },
    onError: () => toast({ title: "Retry failed", variant: "destructive" }),
  });

  const jobQueues = overview?.jobQueues ?? [];
  const backupHistory = overview?.backupHistory ?? [];
  const systemAlerts = overview?.systemAlerts ?? [];
  const systemLogs = overview?.systemLogs ?? [];
  const backupStats = overview?.backupStats ?? { total: 0, lastBackup: null, totalSizeMb: 0 };
  const maintenanceMode = settings?.maintenanceMode ?? overview?.maintenanceMode ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Infrastructure & Monitoring"
        description="Job queues, system alerts, and vendor snapshots."
        actions={
          <>
            <label className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
              <span className="text-sm font-medium">Maintenance mode</span>
              <Switch
                checked={maintenanceMode}
                disabled={maintenanceMutation.isPending}
                onCheckedChange={v => maintenanceMutation.mutate(v)}
              />
            </label>
            <Button variant="outline" size="icon-sm" aria-label="Refresh" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["infrastructure-overview"] }); }} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </>
        }
      />

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : metrics && (
        <>
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-subtle p-3">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-warning dark:text-warning">
              <span className="font-semibold">API process only — not host capacity.</span>{" "}
              CPU and memory below are this Node process. There is no host-metrics agent, so
              disk, cache hit rate and DB pool size are not shown as live gauges.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard
              title="Process uptime"
              value={(metrics as any).uptimeSeconds != null
                ? formatUptimeSeconds(Number((metrics as any).uptimeSeconds))
                : (metrics.uptime || "—")}
              icon={<Activity className="h-4 w-4 text-success" />}
            />
            <KpiCard title="Req/min (this process)" value={Number(metrics.apiRpm || 0).toLocaleString()} icon={<Network className="h-4 w-4 text-primary" />} />
            <KpiCard title="Queue depth" value={metrics.queueDepth} icon={<Activity className="h-4 w-4 text-warning" />} />
            <KpiCard title="Errors today" value={(metrics as any).errorsToday ?? "—"} icon={<AlertTriangle className="h-4 w-4 text-danger" />} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Cpu className="h-4 w-4" /> API process CPU
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-1">{metrics.cpu != null ? `${Number(metrics.cpu).toFixed(1)}%` : "—"}</div>
                <p className="text-xs text-muted-foreground">Sampled from this server process — not rack or VM capacity.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Server className="h-4 w-4" /> API process memory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-1">{metrics.memory != null ? `${Number(metrics.memory).toFixed(1)}%` : "—"}</div>
                <p className="text-xs text-muted-foreground">
                  {(metrics as any).memoryRssBytes
                    ? `${(Number((metrics as any).memoryRssBytes) / (1024 * 1024)).toFixed(0)} MB RSS · `
                    : ""}
                  Share of process heap/RSS relative to Node’s view — not host RAM.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Tabs defaultValue="queues">
        <TabsList>
          <TabsTrigger value="queues">Job Queues</TabsTrigger>
          <TabsTrigger value="alerts">System Alerts</TabsTrigger>
          <TabsTrigger value="backup">Vendor Snapshots</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Queue & Job Monitoring</CardTitle>
                <Button variant="outline" size="sm" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate()}>
                  {retryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Retry All Failed
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {overviewLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : jobQueues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No job queues yet. Tasks and communications will appear here.</p>
              ) : (
                <DataTable
                  data={jobQueues}
                  pageSize={10}
                  columns={[
                    { header: "Queue", cell: (row: any) => <span className="font-medium">{row.name}</span> },
                    { header: "Pending", cell: (row: any) => <Badge variant={row.pending > 20 ? "destructive" : "outline"} className="text-xs">{row.pending}</Badge> },
                    { header: "Running", cell: (row: any) => <span className="text-info font-medium">{row.running}</span> },
                    { header: "Failed", cell: (row: any) => <span className={`font-medium ${row.failed > 0 ? "text-danger" : "text-muted-foreground"}`}>{row.failed}</span> },
                    { header: "Last Run", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.lastRun}</span> },
                    { header: "Status", cell: (row: any) => (
                      <Badge variant={row.status === "Running" ? "outline" : row.status === "Degraded" ? "destructive" : "secondary"} className="text-xs">{row.status}</Badge>
                    )},
                    { header: "Actions", cell: (row: any) => row.failed > 0 ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-warning" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate()}>
                        <Play className="h-3 w-3 mr-1" /> Retry
                      </Button>
                    ) : null },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader><CardTitle>System Alerts</CardTitle></CardHeader>
            <CardContent>
              {systemAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No active alerts.</p>
              ) : (
                <div className="space-y-3">
                  {systemAlerts.map((alert: any, i: number) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${alert.type === "warning" ? "border-warning-border bg-warning-subtle dark:bg-warning-subtle" : "border-info-border bg-info-subtle dark:bg-info-subtle"}`}>
                      {alert.type === "warning" ? <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" /> : <Activity className="h-4 w-4 text-info mt-0.5 shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(alert.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="Last Snapshot" value={backupStats.lastBackup ? formatTime(backupStats.lastBackup) : "—"} icon={<Archive className="h-4 w-4 text-success" />} />
            <KpiCard title="Total Snapshots" value={backupStats.total} icon={<CheckCircle className="h-4 w-4 text-primary" />} />
            <KpiCard title="Snapshot Size" value={`${backupStats.totalSizeMb.toFixed(1)} MB`} icon={<HardDrive className="h-4 w-4 text-info" />} />
          </div>
          <div className="flex items-center gap-3">
            <Button disabled={backupMutation.isPending} onClick={() => backupMutation.mutate()}>
              {backupMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Export Vendor Snapshot
            </Button>
            <p className="text-xs text-muted-foreground max-w-md">
              Writes a CSV of the vendor table to export history. This is not a database backup —
              no full-database restore point is produced.
            </p>
          </div>
          <Card>
            <CardHeader><CardTitle>Snapshot History</CardTitle></CardHeader>
            <CardContent>
              {backupHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No snapshots yet. Export one to get started.</p>
              ) : (
                <DataTable
                  data={backupHistory}
                  pageSize={10}
                  columns={[
                    { header: "Backup ID", cell: (row: any) => <span className="font-mono text-xs">{row.id}</span> },
                    { header: "Type", cell: (row: any) => <span className="font-medium text-sm">{row.type}</span> },
                    { header: "Triggered By", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.triggeredBy}</span> },
                    { header: "Size", cell: (row: any) => <span className="text-sm">{row.size}</span> },
                    { header: "Completed", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.completedAt).toLocaleString()}</span> },
                    { header: "Status", cell: (row: any) => <Badge variant={row.status === "completed" || row.status === "Completed" ? "outline" : "destructive"} className="text-xs">{row.status}</Badge> },
                    { header: "Actions", cell: (row: any) => row.exportId ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => api.exportCenter.download(row.exportId).catch(() => toast({ title: "Download failed", variant: "destructive" }))}>
                        <Download className="h-3 w-3 mr-1" />Download
                      </Button>
                    ) : null },
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>System Logs</CardTitle>
                <Button variant="outline" size="sm" onClick={() => api.exportCenter.create({ module: "audit-logs", format: "csv" }).then(() => toast({ title: "Audit log export queued" })).catch(() => toast({ title: "Export failed", variant: "destructive" }))}>
                  <Download className="mr-2 h-4 w-4" /> Export Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {systemLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No system logs yet.</p>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs space-y-1.5 max-h-[350px] overflow-y-auto">
                  {systemLogs.map((log: string, i: number) => (
                    <div key={i} className={log.includes("ERROR") || log.includes("critical") ? "text-danger" : log.includes("WARN") ? "text-warning" : "text-success"}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
