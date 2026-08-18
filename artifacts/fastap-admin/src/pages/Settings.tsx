import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Globe, Shield, Flag, Clock, RefreshCw, Plug } from "lucide-react";
import { api, type PlatformSettings, type FeatureFlag, type GeoRegion } from "@/lib/apiClient";
import IntegrationsSettings from "@/components/admin/IntegrationsSettings";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_CURRENCY, currencyDisplayLabel } from "@/lib/currency";
import { useState, useEffect } from "react";

export default function Settings() {
  const { data: settings, isLoading } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const { data: settlementRules } = useQuery({ queryKey: ["settlement-rules"], queryFn: api.settlementRules.get });
  const [form, setForm] = useState<Partial<PlatformSettings>>({});
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [geo, setGeo] = useState<GeoRegion[]>([]);
  const [addRegionOpen, setAddRegionOpen] = useState(false);
  const [newRegion, setNewRegion] = useState<GeoRegion>({ country: "", currency: "INR", taxRate: "18%", timezone: "Asia/Kolkata", active: true });
  const { toast } = useToast();

  useEffect(() => {
    if (settings) {
      setForm({ ...settings, currency: PLATFORM_CURRENCY });
      if (settings.featureFlags?.length) setFlags(settings.featureFlags);
      if (settings.geoSettings?.length) {
        setGeo(settings.geoSettings.map((region) => ({ ...region, currency: PLATFORM_CURRENCY })));
      }
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<PlatformSettings>) => api.settings.update(data),
    onSuccess: () => toast({ title: "Settings saved successfully" }),
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const set = (key: keyof PlatformSettings, value: any) => setForm(f => ({ ...f, [key]: value }));

  const persistSettings = (patch: Partial<PlatformSettings>) => {
    const next = {
      ...form,
      ...patch,
      currency: PLATFORM_CURRENCY,
      geoSettings: (patch.geoSettings ?? geo).map((region) => ({
        ...region,
        currency: PLATFORM_CURRENCY,
      })),
    };
    setForm(next);
    saveMutation.mutate(next);
  };

  const toggleFlag = (id: string) => {
    const updated = flags.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f);
    setFlags(updated);
    const flag = updated.find(f => f.id === id);
    persistSettings({ featureFlags: updated });
    toast({ title: `${flag?.name} ${flag?.enabled ? "enabled" : "disabled"}` });
  };

  const toggleGeo = (country: string) => {
    const updated = geo.map(g => g.country === country ? { ...g, active: !g.active } : g);
    setGeo(updated);
    persistSettings({ geoSettings: updated });
    toast({ title: `${country} ${updated.find(g => g.country === country)?.active ? "activated" : "deactivated"}` });
  };

  const addRegion = () => {
    if (!newRegion.country.trim()) return;
    const updated = [...geo, newRegion];
    setGeo(updated);
    persistSettings({ geoSettings: updated });
    setNewRegion({ country: "", currency: "INR", taxRate: "18%", timezone: "Asia/Kolkata", active: true });
    setAddRegionOpen(false);
    toast({ title: `${newRegion.country} region added` });
  };

  const archiveMutation = useMutation({
    mutationFn: api.infrastructure.triggerBackup,
    onSuccess: () => toast({ title: "Data archive backup completed" }),
    onError: () => toast({ title: "Archive failed", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const flagGroups = [...new Set(flags.map(f => f.group))];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-2xl font-bold tracking-tight">System Configuration</h2><p className="text-muted-foreground">Global platform settings, feature flags, and regional controls.</p></div>
        <Button onClick={() => saveMutation.mutate({
          ...form,
          currency: PLATFORM_CURRENCY,
          featureFlags: flags,
          geoSettings: geo.map((region) => ({ ...region, currency: PLATFORM_CURRENCY })),
        })} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Configuration
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="geo">Geo & Region</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Platform Identity</CardTitle><CardDescription>Core branding and contact information.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1"><Label>Platform Name</Label><Input value={form.platformName || ""} onChange={e => set("platformName", e.target.value)} /></div>
                <div className="space-y-1"><Label>Platform URL</Label><Input value={form.platformUrl || ""} onChange={e => set("platformUrl", e.target.value)} /></div>
                <div className="space-y-1"><Label>Support Email</Label><Input type="email" value={form.supportEmail || ""} onChange={e => set("supportEmail", e.target.value)} /></div>
                <div className="space-y-1"><Label>Support Phone</Label><Input value={form.supportPhone || ""} onChange={e => set("supportPhone" as any, e.target.value)} placeholder="+91 XXXXX XXXXX" /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Platform Controls</CardTitle><CardDescription>Operational toggles.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                {[
                  { key: "maintenanceMode", label: "Maintenance Mode", desc: "Show maintenance page to all users" },
                  { key: "registrationOpen", label: "Open Registration", desc: "Allow new vendors to sign up" },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div><p className="font-medium text-sm">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                    <Switch checked={!!(form as any)[item.key]} onCheckedChange={v => set(item.key as any, v)} />
                  </div>
                ))}
                <div className="space-y-1 pt-2 border-t">
                  <Label>Default Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="ar">Arabic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* FINANCIAL */}
        <TabsContent value="financial" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Payout Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1"><Label>Default Commission (%)</Label><Input type="number" value={form.defaultCommission ?? 5} onChange={e => set("defaultCommission", Number(e.target.value))} /></div>
                <div className="space-y-1"><Label>Minimum Payout Amount</Label><Input type="number" value={form.minPayoutAmount ?? 100} onChange={e => set("minPayoutAmount", Number(e.target.value))} /></div>
                <div className="space-y-1"><Label>Payout Cycle</Label>
                  <Select value={form.payoutCycle || "weekly"} onValueChange={v => set("payoutCycle", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly (15 days)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Settlement Hold Period (days)</Label><Input type="number" defaultValue={3} /></div>
                <div className="space-y-1"><Label>Settlement Cycle</Label>
                  <Select value={settlementRules?.defaultCycle || form.payoutCycle || "weekly"} onValueChange={v => api.settlementRules.save({ ...settlementRules, defaultCycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(settlementRules?.cycles ?? ["daily", "weekly", "15_days", "monthly", "manual"]).map((c: string) => (
                        <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Auto-Hold Rules</CardTitle><CardDescription>Automatic settlement holds based on risk signals.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {(settlementRules?.autoHoldRules ?? []).map((rule: { id: string; name: string; enabled: boolean }) => (
                  <div key={rule.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{rule.name}</span>
                    <Switch checked={rule.enabled} onCheckedChange={v => {
                      const updated = (settlementRules?.autoHoldRules ?? []).map((r: { id: string }) => r.id === rule.id ? { ...rule, enabled: v } : r);
                      api.settlementRules.save({ ...settlementRules, autoHoldRules: updated });
                    }} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Currency & Taxes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1"><Label>System Currency</Label>
                  <Input value={currencyDisplayLabel()} readOnly disabled />
                  <p className="text-xs text-muted-foreground">All panels and apps display amounts in Indian Rupees (₹).</p>
                </div>
                <div className="space-y-1"><Label>Default GST Rate (%)</Label><Input type="number" defaultValue={18} /></div>
                <div className="space-y-1"><Label>TDS Rate (%)</Label><Input type="number" defaultValue={2} /></div>
                <div className="flex items-center justify-between pt-2">
                  <div><p className="font-medium text-sm">Tax Invoice Auto-generate</p><p className="text-xs text-muted-foreground">Auto-create invoice on every transaction</p></div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Timezone</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Select value={form.timezone || "UTC"} onValueChange={v => set("timezone", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Asia/Kolkata">IST (India)</SelectItem>
                      <SelectItem value="Asia/Dubai">GST (Dubai)</SelectItem>
                      <SelectItem value="America/New_York">EST (US East)</SelectItem>
                      <SelectItem value="Europe/London">GMT (London)</SelectItem>
                      <SelectItem value="Asia/Singapore">SGT (Singapore)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* FEATURE FLAGS */}
        <TabsContent value="features" className="mt-4">
          <div className="space-y-6">
            {flagGroups.map(group => (
              <Card key={group}>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flag className="h-4 w-4 text-primary" />{group}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {flags.filter(f => f.group === group).map(flag => (
                      <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{flag.name}</span>
                            {flag.beta && <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">Beta</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                        </div>
                        <Switch checked={flag.enabled} onCheckedChange={() => toggleFlag(flag.id)} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* GEO & REGION */}
        <TabsContent value="geo" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Geo & Region Management</CardTitle>
                  <CardDescription>Regional tax and timezone settings. All amounts use INR (₹).</CardDescription>
                </div>
                <Button size="sm" onClick={() => setAddRegionOpen(true)}>Add Region</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {geo.map((region, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{region.country}</p>
                      <p className="text-xs text-muted-foreground">{region.timezone} · INR (₹) · GST/VAT: {region.taxRate}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={region.active ? "outline" : "secondary"} className={region.active ? "text-green-600" : ""}>{region.active ? "Active" : "Inactive"}</Badge>
                      <Switch checked={region.active} onCheckedChange={() => toggleGeo(region.country)} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Admin Security</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {[
                  { label: "Two-Factor Authentication", key: "twoFactor", desc: "Require 2FA for all admin logins" },
                  { label: "OTP Verification", key: "otp", desc: "OTP on sensitive actions (payouts, refunds)" },
                  { label: "IP Whitelist Enforcement", key: "ipWhitelistEnforced", desc: "Restrict admin access to whitelisted IPs" },
                  { label: "Session Timeout (30 min)", key: "sessionTimeout", desc: "Auto-logout after 30 minutes of inactivity" },
                  { label: "Device Tracking", key: "deviceTracking", desc: "Track and alert on new device logins" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div><p className="font-medium text-sm">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                    <Switch
                      checked={form.securitySettings?.[item.key] ?? ["twoFactor", "otp", "sessionTimeout", "deviceTracking"].includes(item.key)}
                      onCheckedChange={v => persistSettings({ securitySettings: { ...form.securitySettings, [item.key]: v } })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Data Retention</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Transaction Log Retention", value: "365 days" },
                  { label: "Audit Log Retention", value: "730 days" },
                  { label: "Vendor Data Archive", value: "After 2 years inactive" },
                  { label: "Session Log Retention", value: "90 days" },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 border rounded-lg">
                    <span className="text-sm">{item.label}</span>
                    <Badge variant="outline" className="text-xs">{item.value}</Badge>
                  </div>
                ))}
                <Button variant="outline" className="w-full" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate()}><RefreshCw className={`mr-2 h-4 w-4 ${archiveMutation.isPending ? "animate-spin" : ""}`} /> Run Data Archive Now</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* INTEGRATIONS */}
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsSettings
            integrations={form.integrations ?? settings?.integrations}
            onSaved={cfg => setForm(f => ({ ...f, integrations: cfg }))}
          />
        </TabsContent>
      </Tabs>

      {addRegionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Add Region</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Country</Label><Input value={newRegion.country} onChange={e => setNewRegion(r => ({ ...r, country: e.target.value }))} placeholder="India" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Currency</Label><Input value={currencyDisplayLabel()} readOnly disabled /></div>
                <div className="space-y-2"><Label>Tax Rate</Label><Input value={newRegion.taxRate} onChange={e => setNewRegion(r => ({ ...r, taxRate: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Timezone</Label><Input value={newRegion.timezone} onChange={e => setNewRegion(r => ({ ...r, timezone: e.target.value }))} /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddRegionOpen(false)}>Cancel</Button>
                <Button onClick={addRegion}>Add Region</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
