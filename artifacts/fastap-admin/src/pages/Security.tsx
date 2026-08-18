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
  });

  const addIpWhitelist = useMutation({
    mutationFn: (ip: string) => api.security.addIpWhitelist(ip),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security"] }); toast({ title: "IP whitelisted" }); setIpInput(""); },
  });

  const removeIpWhitelist = useMutation({
    mutationFn: api.security.removeIpWhitelist,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security"] }); toast({ title: "IP removed from whitelist" }); },
  });

  const securitySettings = security?.securitySettings ?? {};
  const sessions = security?.sessions || [];
  const devices = security?.devices || [];
  const ipWhitelist = security?.ipWhitelist || [];
  const loginAttempts = security?.loginAttempts || [];

  const updateSecuritySetting = useMutation({
    mutationFn: (patch: Record<string, boolean>) => api.security.updateSettings(patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["security"] }); },
    onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Center</h2>
          <p className="text-muted-foreground">2FA, sessions, IP restrictions, device tracking & access control.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Active Sessions" value={sessions.length} icon={<Monitor className="h-4 w-4 text-green-500" />} />
        <KpiCard title="Registered Devices" value={devices.length} icon={<Smartphone className="h-4 w-4 text-blue-500" />} />
        <KpiCard title="Whitelisted IPs" value={ipWhitelist.length} icon={<Globe className="h-4 w-4 text-purple-500" />} />
        <KpiCard title="Failed Logins (24h)" value={loginAttempts.filter((a: any) => a.success === false).length} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">Security Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Two-Factor Authentication", desc: "Require 2FA for admin login", key: "twoFactor" },
              { label: "OTP Verification", desc: "OTP on sensitive actions", key: "otp" },
              { label: "Session Timeout (30min)", desc: "Auto logout after inactivity", key: "sessionTimeout" },
              { label: "Device Tracking", desc: "Track all logged-in devices", key: "deviceTracking" },
              { label: "IP Whitelist Enforced", desc: "Restrict login to whitelisted IPs", key: "ipWhitelistEnforced" },
              { label: "Forced Password Reset", desc: "Require password change every 90 days", key: "forcePasswordReset" },
            ].map(setting => (
              <div key={setting.key} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{setting.label}</p>
                  <p className="text-xs text-muted-foreground">{setting.desc}</p>
                </div>
                <Switch
                  checked={securitySettings[setting.key] ?? ["twoFactor", "deviceTracking", "sessionTimeout"].includes(setting.key)}
                  onCheckedChange={v => {
                    updateSecuritySetting.mutate({ [setting.key]: v });
                    toast({ title: `${setting.label} ${v ? "enabled" : "disabled"}` });
                  }}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">IP Whitelist</CardTitle><CardDescription>Only whitelisted IPs can access the admin panel</CardDescription></CardHeader>
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
