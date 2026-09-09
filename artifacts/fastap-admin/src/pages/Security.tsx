import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { KpiCard } from "@/components/shared/KpiCard";
import { DataTable } from "@/components/shared/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, Smartphone, Monitor, Loader2, RefreshCw, XCircle, Plus, Trash2, Globe, AlertTriangle, Key, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/Page";

// These switches persist to platform settings, but nothing in the API reads them back:
// login does not check the IP list, issue a second factor, expire idle sessions, or age
// passwords. They are recorded intent, not active controls, and are labelled as such so
// nobody assumes the admin panel is protected by a control that is not actually running.
const SECURITY_SETTINGS = [
  { label: "Two-Factor Authentication", desc: "Require 2FA for admin login", key: "twoFactor" },
  { label: "OTP Verification", desc: "OTP on sensitive actions", key: "otp" },
  { label: "Session Timeout (30min)", desc: "Auto logout after inactivity", key: "sessionTimeout" },
  { label: "Device Tracking", desc: "Track all logged-in devices", key: "deviceTracking" },
  { label: "IP Whitelist Enforced", desc: "Restrict login to whitelisted IPs", key: "ipWhitelistEnforced" },
  { label: "Forced Password Reset", desc: "Require password change every 90 days", key: "forcePasswordReset" },
];

export default function Security() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [ipInput, setIpInput] = useState("");

  const { data: security, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["security"],
    queryFn: api.security.get,
  });

  const revokeSession = useMutation({
    mutationFn: api.security.revokeSession,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security"] }); toast({ title: "Session revoked" }); },
    onError: () => toast({ title: "Failed to revoke session", variant: "destructive" }),
  });

  const addIpWhitelist = useMutation({
    mutationFn: (ip: string) => api.security.addIpWhitelist(ip),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security"] }); toast({ title: "IP added to the list" }); setIpInput(""); },
    onError: () => toast({ title: "Failed to add IP", variant: "destructive" }),
  });

  const removeIpWhitelist = useMutation({
    mutationFn: api.security.removeIpWhitelist,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security"] }); toast({ title: "IP removed from the list" }); },
    onError: () => toast({ title: "Failed to remove IP", variant: "destructive" }),
  });

  const securitySettings = security?.securitySettings ?? {};
  const sessions = security?.sessions || [];
  const devices = security?.devices || [];
  const ipWhitelist = security?.ipWhitelist || [];
  const loginAttempts = security?.loginAttempts || [];

  const updateSecuritySetting = useMutation({
    mutationFn: (patch: Record<string, boolean>) => api.security.updateSettings(patch),
    onSuccess: (_d, patch) => {
      qc.invalidateQueries({ queryKey: ["security"] });
      const [key, value] = Object.entries(patch)[0] ?? [];
      const label = SECURITY_SETTINGS.find(s => s.key === key)?.label ?? "Setting";
      toast({ title: `${label} ${value ? "enabled" : "disabled"}` });
    },
    onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Center"
        description="Two-factor policy, active admin sessions, and the IP allow list."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Active Sessions" value={sessions.length} icon={<Monitor className="h-4 w-4 text-success" />} />
        <KpiCard title="Registered Devices" value={devices.length} icon={<Smartphone className="h-4 w-4 text-info" />} />
        <KpiCard title="Whitelisted IPs" value={ipWhitelist.length} icon={<Globe className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard title="Failed Logins (24h)" value={loginAttempts.filter((a: any) => a.success === false).length} icon={<AlertTriangle className="h-4 w-4 text-danger" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Security Settings</CardTitle>
            <CardDescription className="text-warning dark:text-warning">
              Saved as policy only — none of these are enforced at login yet. Do not rely on
              them to restrict access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {SECURITY_SETTINGS.map(setting => (
              <div key={setting.key} className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">{setting.label}</p>
                    <Badge variant="secondary" className="text-[10px]">Not enforced</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{setting.desc}</p>
                </div>
                <Switch
                  checked={securitySettings[setting.key] ?? ["twoFactor", "deviceTracking", "sessionTimeout"].includes(setting.key)}
                  disabled={updateSecuritySetting.isPending}
                  onCheckedChange={v => updateSecuritySetting.mutate({ [setting.key]: v })}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">IP Whitelist</CardTitle>
            <CardDescription>
              Addresses are stored, but login does not check this list — it does not currently
              restrict who can reach the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input placeholder="Enter IP address (e.g. 192.168.1.1)" value={ipInput} onChange={e => setIpInput(e.target.value)} />
              <Button onClick={() => { if (ipInput.trim()) addIpWhitelist.mutate(ipInput.trim()); }} disabled={!ipInput.trim() || addIpWhitelist.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-2">
                {ipWhitelist.map((ip: any) => (
                  <div key={ip.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-mono font-medium">{ip.address}</p>
                        <p className="text-xs text-muted-foreground">{ip.label} · Added {new Date(ip.addedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeIpWhitelist.mutate(ip.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                {ipWhitelist.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No IPs whitelisted. All IPs allowed.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="logins">Login Attempts</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <DataTable data={sessions} pageSize={10} columns={[
                  { header: "User", cell: (row: any) => <span className="font-medium">{row.user}</span> },
                  { header: "IP Address", cell: (row: any) => <span className="font-mono text-xs">{row.ipAddress}</span> },
                  { header: "Device", cell: (row: any) => <span className="text-sm">{row.device}</span> },
                  { header: "Location", cell: (row: any) => <span className="text-sm text-muted-foreground">{row.location}</span> },
                  { header: "Started", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.startedAt).toLocaleString()}</span> },
                  { header: "Last Active", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.lastActive).toLocaleString()}</span> },
                  { header: "Status", cell: (row: any) => <Badge variant={row.current ? "default" : "secondary"} className="text-xs">{row.current ? "Current" : "Active"}</Badge> },
                  { header: "Action", cell: (row: any) => (
                    !row.current && (
                      <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => revokeSession.mutate(row.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Revoke
                      </Button>
                    )
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : devices.length === 0 ? (
                // The API returns an empty device list unconditionally — there is no device
                // registry behind it, so say that rather than showing a hopeful empty table.
                <p className="text-center text-sm text-muted-foreground py-12">
                  Device tracking is not implemented on the API — no devices are recorded.
                </p>
              ) : (
                <DataTable data={devices} pageSize={10} columns={[
                  { header: "Device", cell: (row: any) => (
                    <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{row.name}</span></div>
                  )},
                  { header: "User", accessorKey: "user" },
                  { header: "OS / Browser", cell: (row: any) => <span className="text-sm text-muted-foreground">{row.os} / {row.browser}</span> },
                  { header: "IP", cell: (row: any) => <span className="font-mono text-xs">{row.ipAddress}</span> },
                  { header: "First Seen", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.firstSeen).toLocaleDateString()}</span> },
                  { header: "Last Seen", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.lastSeen).toLocaleString()}</span> },
                  { header: "Status", cell: (row: any) => <Badge variant={row.trusted ? "default" : "secondary"} className="text-xs">{row.trusted ? "Trusted" : "Unknown"}</Badge> },
                  { header: "Action", cell: (row: any) => (
                    <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={() => revokeSession.mutate(row.id || `dev_${row.name}`)}>
                      Revoke
                    </Button>
                  )},
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logins" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : (
                <DataTable data={loginAttempts} pageSize={10} columns={[
                  { header: "Email", cell: (row: any) => <span className="font-medium text-sm">{row.email}</span> },
                  { header: "IP Address", cell: (row: any) => <span className="font-mono text-xs">{row.ipAddress}</span> },
                  { header: "Location", cell: (row: any) => <span className="text-sm text-muted-foreground">{row.location}</span> },
                  { header: "Device", accessorKey: "device" },
                  { header: "Timestamp", cell: (row: any) => <span className="text-xs text-muted-foreground">{new Date(row.timestamp).toLocaleString()}</span> },
                  { header: "Result", cell: (row: any) => (
                    <Badge variant={row.success ? "default" : "destructive"} className="text-xs">{row.success ? "Success" : "Failed"}</Badge>
                  )},
                  { header: "Reason", cell: (row: any) => <span className="text-xs text-muted-foreground">{row.failReason || "—"}</span> },
                ]} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
