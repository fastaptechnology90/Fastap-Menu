import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Activity, Server, Database, Cpu, HardDrive, Network, RefreshCw, Loader2, AlertTriangle, CheckCircle, Clock, Download, Play, RotateCcw, Archive } from "lucide-react";
import { api, type InfraMetrics } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

function formatTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
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

  const backupMutation = useMutation({
    mutationFn: api.infrastructure.triggerBackup,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["infrastructure-overview"] });
      toast({ title: "Backup completed", description: `${data.id} — ${data.sizeMb} MB` });
    },
    onError: () => toast({ title: "Backup failed", variant: "destructive" }),
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

  const MetricCard = ({ icon, title, value, max, unit }: { icon: React.ReactNode; title: string; value?: number; max?: number; unit?: string }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">{icon} {title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">{value ?? "—"}{unit}</div>
        {max !== undefined && value !== undefined && <Progress value={Math.min(value, 100)} className={`h-2 ${value > 80 ? "[&>div]:bg-red-500" : value > 60 ? "[&>div]:bg-yellow-500" : ""}`} />}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">Infrastructure & Monitoring</h2><p className="text-muted-foreground">Real-time cluster health, job queues, and backup management.</p></div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-md p-2 bg-card">
            <span className="text-sm font-medium">Maintenance Mode</span>
            <Switch
              checked={maintenanceMode}
              disabled={maintenanceMutation.isPending}
              onCheckedChange={v => maintenanceMutation.mutate(v)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["infrastructure-overview"] }); }} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : metrics && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard title="Uptime" value={metrics.uptime} icon={<Activity className="h-4 w-4 text-green-500" />} />
            <KpiCard title="API Req/min" value={metrics.apiRpm.toLocaleString()} icon={<Network className="h-4 w-4 text-primary" />} />
            <KpiCard title="Cache Hit Rate" value={`${metrics.cacheHitRate}%`} icon={<Server className="h-4 w-4 text-blue-500" />} />
            <KpiCard title="Queue Depth" value={metrics.queueDepth} icon={<Activity className="h-4 w-4 text-yellow-500" />} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={<Cpu className="h-4 w-4" />} title="CPU Usage" value={metrics.cpu} max={100} unit="%" />
            <MetricCard icon={<Server className="h-4 w-4" />} title="Memory" value={metrics.memory} max={100} unit="%" />
            <MetricCard icon={<HardDrive className="h-4 w-4" />} title="Disk" value={metrics.disk} max={100} unit="%" />
            <MetricCard icon={<Database className="h-4 w-4" />} title="DB Connections" value={metrics.dbConnections} unit="" />
          </div>
        </>
      )}

      <Tabs defaultValue="queues">
        <TabsList>
          <TabsTrigger value="queues">Job Queues</TabsTrigger>
          <TabsTrigger value="alerts">System Alerts</TabsTrigger>
          <TabsTrigger value="backup">Backup & Recovery</TabsTrigger>
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
                    { header: "Running", cell: (row: any) => <span className="text-blue-500 font-medium">{row.running}</span> },
                    { header: "Failed", cell: (row: any) => <span className={`font-medium ${row.failed > 0 ? "text-red-500" : "text-muted-foreground"}`}>{row.failed}</span> },
                    { header: "Last Run", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.lastRun}</span> },
                    { header: "Status", cell: (row: any) => (
                      <Badge variant={row.status === "Running" ? "outline" : row.status === "Degraded" ? "destructive" : "secondary"} className="text-xs">{row.status}</Badge>
                    )},
                    { header: "Actions", cell: (row: any) => row.failed > 0 ? (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-orange-500" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate()}>
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
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${alert.type === "warning" ? "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20" : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20"}`}>
                      {alert.type === "warning" ? <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" /> : <Activity className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
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
            <KpiCard title="Last Backup" value={backupStats.lastBackup ? formatTime(backupStats.lastBackup) : "—"} icon={<Archive className="h-4 w-4 text-green-500" />} />
            <KpiCard title="Total Backups" value={backupStats.total} icon={<CheckCircle className="h-4 w-4 text-primary" />} />
            <KpiCard title="Backup Size" value={`${backupStats.totalSizeMb.toFixed(1)} MB`} icon={<HardDrive className="h-4 w-4 text-blue-500" />} />
          </div>
          <div className="flex gap-2">
            <Button disabled={backupMutation.isPending} onClick={() => backupMutation.mutate()}>
              {backupMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
              Trigger Backup Now
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle>Backup History</CardTitle></CardHeader>
            <CardContent>
              {backupHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No backups yet. Trigger a backup to get started.</p>
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
                    <div key={i} className={log.includes("ERROR") || log.includes("critical") ? "text-red-400" : log.includes("WARN") ? "text-yellow-400" : "text-green-400"}>
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
