import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, Search, Eye, Clock, User, Download, X, CheckCircle, Ban, Loader, Monitor, Smartphone, Tv, Printer, Tablet, Nfc, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { auditLogs, hardwareApi } from "@/lib/api";

type Tab = "audit"|"fraud"|"devices";

type AuditRow = {
  id: string; action: string; user: string; role: string; ip: string; details: string;
  category: string; risk: string; time: string; table: string;
};

type FraudRow = {
  id: string; type: string; description: string; user: string; risk: string; time: string; amount: string; action: string | null;
};

type DeviceRow = {
  id: string; name: string; type: string; ip: string; user: string; lastSeen: string; status: string; os: string; appVersion: string;
};

const RISK_CFG: Record<string,{label:string;color:string;bg:string}> = {
  critical: {label:"Critical",color:"text-danger",   bg:"bg-danger-subtle"},
  high:     {label:"High",    color:"text-warning", bg:"bg-warning-subtle"},
  medium:   {label:"Medium",  color:"text-warning", bg:"bg-warning-subtle"},
  low:      {label:"Low",     color:"text-success",bg:"bg-success-subtle"},
  info:     {label:"Info",    color:"text-muted-foreground",   bg:"bg-muted"},
};

const CATEGORY_CFG: Record<string,{color:string}> = {
  billing:  {color:"text-primary"},
  staff:    {color:"text-info"},
  menu:     {color:"text-muted-foreground"},
  auth:     {color:"text-danger"},
  settings: {color:"text-warning"},
  data:     {color:"text-success"},
  general:  {color:"text-muted-foreground"},
};

const DEVICE_TYPE_CFG: Record<string,{icon:LucideIcon;color:string}> = {
  pos: {icon:Monitor,color:"text-info"},
  tablet: {icon:Smartphone,color:"text-muted-foreground"},
  phone: {icon:Smartphone,color:"text-success"},
  kds: {icon:Tv,color:"text-primary"},
  display: {icon:Tv,color:"text-primary"},
  printer: {icon:Printer,color:"text-warning"},
  handheld: {icon:Tablet,color:"text-success"},
  nfc: {icon:Nfc,color:"text-muted-foreground"},
  kiosk: {icon:Monitor,color:"text-info"},
  unknown: {icon:HelpCircle,color:"text-danger"},
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const prefix = d.toDateString() === today.toDateString() ? "Today" : d.toLocaleDateString();
  return `${prefix} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function mapAuditLog(row: any): AuditRow {
  const details = typeof row.details === "object" && row.details ? row.details : {};
  const severity = row.severity || "info";
  const risk = severity === "warning" ? "medium" : severity;
  return {
    id: String(row.id),
    action: row.action || "Action",
    user: row.performedBy || "Staff",
    role: row.role || "staff",
    ip: row.ipAddress || "—",
    details: typeof details === "object" ? (details.summary as string) || JSON.stringify(details) : String(details),
    category: row.category || "general",
    risk,
    time: row.createdAt ? formatTime(row.createdAt) : "—",
    table: (details.table as string) || "—",
  };
}

function mapDevice(row: any): DeviceRow {
  const lastPing = row.last_ping ? formatTime(row.last_ping) : "—";
  const status = row.status === "online" ? "active" : row.status === "offline" ? "inactive" : row.status || "inactive";
  return {
    id: String(row.id),
    name: row.name || "Device",
    type: row.type || "unknown",
    ip: row.ip || "—",
    user: row.location || row.assignedTo || "—",
    lastSeen: lastPing,
    status: status === "active" ? "active" : status,
    os: row.model || row.firmware || "—",
    appVersion: row.firmware || "—",
  };
}

export default function AuditLogs() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("audit");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [alerts, setAlerts] = useState<FraudRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem("fastap_fraud_reviewed") || "[]")));

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setApiError(null);
    try {
      const [logRows, hw] = await Promise.all([
        auditLogs.list(restaurantId),
        hardwareApi.get(restaurantId),
      ]);
      const mapped = Array.isArray(logRows) ? logRows.map(mapAuditLog) : [];
      setLogs(mapped);
      const reviewed = new Set<string>(JSON.parse(localStorage.getItem("fastap_fraud_reviewed") || "[]"));
      setAlerts(mapped.filter(l => l.risk === "high" || l.risk === "critical").map(l => ({
        id: l.id,
        type: l.action,
        description: l.details,
        user: l.user,
        risk: l.risk,
        time: l.time,
        amount: "—",
        action: reviewed.has(l.id) ? "reviewed" : null,
      })));
      const deviceList = hw?.devices ?? (Array.isArray(hw) ? hw : []);
      setDevices(Array.isArray(deviceList) ? deviceList.map(mapDevice) : []);
    } catch {
      setApiError("Could not load audit data.");
      setLogs([]);
      setAlerts([]);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const filteredLogs = logs.filter(l =>
    (riskFilter === "all" || l.risk === riskFilter) &&
    (catFilter === "all" || l.category === catFilter) &&
    (!search || l.action.toLowerCase().includes(search.toLowerCase()) || l.user.toLowerCase().includes(search.toLowerCase()) || l.details.toLowerCase().includes(search.toLowerCase())),
  );

  const criticalCount = alerts.filter(a => a.risk === "critical" && !a.action).length;
  const highCount = alerts.filter(a => a.risk === "high" && !a.action).length;

  function reviewAlert(id: string) {
    const next = new Set(reviewedIds); next.add(id);
    setReviewedIds(next);
    localStorage.setItem("fastap_fraud_reviewed", JSON.stringify([...next]));
    setAlerts(a => a.map(x => x.id === id ? { ...x, action: "reviewed" } : x));
  }

  function blockDevice(id: string) {
    if (!restaurantId) return;
    hardwareApi.update(restaurantId, parseInt(id, 10), { status: "offline" })
      .then(() => toast({ title: "Device blocked" }))
      // Silence here meant a device the owner believed blocked was still online.
      .catch(e => toast({ title: "Device not blocked", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
    setDevices(d => d.map(x => x.id === id ? { ...x, status: "blocked" } : x));
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Audit & Security</h1>
            {(criticalCount + highCount) > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-danger-subtle text-danger text-xs font-semibold">
                <AlertTriangle className="h-3 w-3"/>{criticalCount + highCount} alerts
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Complete action log, fraud detection and device management</p>
        </div>
        <button onClick={() => load()} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-muted hover-elevate text-sm font-semibold transition-colors">
          <Download className="h-4 w-4 text-primary"/>Refresh
        </button>
      </div>

      {apiError && <div className="p-3 rounded-lg bg-danger-subtle border border-danger-border text-danger text-sm">{apiError}</div>}
      {loading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader className="h-4 w-4 animate-spin"/>Loading audit data...</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Events", value: logs.length, color: "text-foreground", bg: "bg-muted" },
          { label: "High Risk", value: logs.filter(l => l.risk === "high").length, color: "text-warning", bg: "bg-warning-subtle" },
          { label: "Fraud Alerts", value: alerts.filter(a => !a.action).length, color: "text-danger", bg: "bg-danger-subtle" },
          { label: "Active Devices", value: devices.filter(d => d.status === "active").length, color: "text-success", bg: "bg-success-subtle" },
        ].map(s => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["audit", "Audit Trail"], ["fraud", "Fraud Alerts"], ["devices", "Devices"]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "audit" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <input className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search actions, users..." value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all", "high", "medium", "low"].map(r => (
                <button key={r} onClick={() => setRiskFilter(r)} className={`px-3 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${riskFilter === r ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>{r === "all" ? "All Risk" : r}</button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {filteredLogs.map(log => {
              const rcfg = RISK_CFG[log.risk] || RISK_CFG.info;
              const ccfg = CATEGORY_CFG[log.category] || CATEGORY_CFG.general;
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted border border-transparent hover:border-border cursor-pointer transition-colors" onClick={() => setSelected(log)}>
                  <div className={`h-8 w-8 rounded-lg ${rcfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Shield className={`h-4 w-4 ${rcfg.color}`}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{log.action}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${rcfg.bg} ${rcfg.color}`}>{rcfg.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-md bg-muted ${ccfg.color}`}>{log.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3"/>{log.user}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{log.time}</span>
                    </div>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-1"/>
                </div>
              );
            })}
            {filteredLogs.length === 0 && !loading && <div className="text-center py-12 text-muted-foreground"><Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground"/><p>No audit logs yet</p></div>}
          </div>
        </>
      )}

      {tab === "fraud" && (
        <div className="space-y-3">
          {alerts.map(alert => {
            const rcfg = RISK_CFG[alert.risk] || RISK_CFG.high;
            const reviewed = !!alert.action;
            return (
              <div key={alert.id} className={`bg-card border rounded-lg p-5 transition-colors ${reviewed ? "border-border opacity-60" : "border-warning-border"}`}>
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-lg ${rcfg.bg} flex items-center justify-center shrink-0`}>
                    <AlertTriangle className={`h-5 w-5 ${rcfg.color}`}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{alert.type}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rcfg.bg} ${rcfg.color}`}>{rcfg.label}</span>
                    </div>
                    <p className="text-sm text-foreground">{alert.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3"/>{alert.user}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{alert.time}</span>
                    </div>
                  </div>
                  {!reviewed && (
                    <button onClick={() => reviewAlert(alert.id)} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate shrink-0 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3"/>Mark Reviewed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {alerts.length === 0 && !loading && <p className="text-center text-muted-foreground py-12">No fraud alerts — all clear</p>}
        </div>
      )}

      {tab === "devices" && (
        <div className="space-y-3">
          {devices.map(device => {
            const dcfg = DEVICE_TYPE_CFG[device.type] || DEVICE_TYPE_CFG.unknown;
            return (
              <div key={device.id} className={`bg-card border rounded-lg p-4 ${device.status === "blocked" ? "border-danger-border opacity-50" : "border-border"}`}>
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${dcfg.color}`}><dcfg.icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold">{device.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${device.status === "active" ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground"}`}>{device.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{device.user}</span>
                      <span>IP: {device.ip}</span>
                      <span>{device.os}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Last: {device.lastSeen}</span>
                    </div>
                  </div>
                  {device.status !== "blocked" && (
                    <button onClick={() => blockDevice(device.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-danger-border bg-danger-subtle text-danger text-xs font-semibold hover-elevate">
                      <Ban className="h-3 w-3"/>Block
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {devices.length === 0 && !loading && <p className="text-center text-muted-foreground py-12">No hardware devices registered</p>}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Audit Log Detail</h2>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${(RISK_CFG[selected.risk] || RISK_CFG.info).bg}`}>
                <p className={`font-semibold ${(RISK_CFG[selected.risk] || RISK_CFG.info).color}`}>{selected.action}</p>
              </div>
              {[
                { label: "Details", value: selected.details },
                { label: "User", value: selected.user },
                { label: "Role", value: selected.role },
                { label: "IP Address", value: selected.ip },
                { label: "Time", value: selected.time },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-border last:border-0 text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold text-right max-w-56 truncate">{r.value}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} className="mt-5 w-full py-2.5 rounded-lg bg-muted border border-border font-semibold text-sm hover-elevate">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
