import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Wallet, Settings, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { ROLE_PERMISSIONS } from "@/lib/adminRbac";

const ICONS: Record<string, typeof Shield> = {
  "Super Admin": Shield,
  "Finance Admin": Wallet,
  "Support Admin": Users,
  "Compliance Admin": Settings,
};

// These are the only permission keys the API reads back when it resolves a role
// (resolveAdminPermissions). `writes` is the exact key shape it looks for, so a module
// switched on here really does open that part of the API for the role.
const MODULES: { key: string; label: string; description: string; writes: string[] }[] = [
  { key: "finance", label: "Finance", description: "Payments, refunds, settlements, escrow, invoices, taxes", writes: ["finance", "refunds", "payouts"] },
  { key: "vendors", label: "Vendors", description: "Restaurants, plans, subscriptions, coupons, CRM", writes: ["vendors"] },
  { key: "support", label: "Support", description: "Tickets, SLA monitoring, internal tasks", writes: ["support"] },
  { key: "compliance", label: "Compliance", description: "KYC, document vault, agreements, legal", writes: ["kyc", "documents"] },
  { key: "operations", label: "Operations", description: "Infrastructure, fraud, incidents, alerts, QR/NFC", writes: ["operations"] },
  { key: "communications", label: "Communications", description: "Announcements, notifications, broadcasts, blog", writes: ["communications"] },
];

function roleKeyFor(name: string): string {
  return String(name ?? "").toLowerCase().trim().replace(/\s+/g, "_");
}

export default function Roles() {
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useQuery({ queryKey: ["platform-roles"], queryFn: api.roles.list });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles.find((r: any) => String(r.id) === selectedId) ?? roles[0];

  const [localModules, setLocalModules] = useState<Record<string, boolean> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: { id: string; permissions: Record<string, boolean> }) =>
      api.roles.update(data.id, { permissions: data.permissions }),
    onSuccess: () => {
      setLocalModules(null);
      qc.invalidateQueries({ queryKey: ["platform-roles"] });
      toast.success("Role permissions saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isSuperAdmin = selected?.name === "Super Admin" && selected?.isSystem;
  const roleKey = selected ? roleKeyFor(selected.name) : "";
  // A role keeps its built-in modules whatever is stored against it, so those toggles are
  // shown locked rather than pretending they can be switched off.
  const baseline = new Set<string>(ROLE_PERMISSIONS[roleKey] ?? []);

  const storedPerms = (selected?.permissions as Record<string, boolean>) ?? {};
  const storedModules: Record<string, boolean> = {};
  for (const m of MODULES) storedModules[m.key] = m.writes.some(k => !!storedPerms[k]);

  const currentModules = localModules ?? storedModules;
  const dirty = localModules !== null && MODULES.some(m => currentModules[m.key] !== storedModules[m.key]);

  const toggleModule = (key: string) => {
    if (isSuperAdmin) {
      toast.error("Super Admin permissions cannot be modified");
      return;
    }
    if (baseline.has(key)) {
      toast.error("This module is built in to the role and cannot be switched off");
      return;
    }
    setLocalModules(prev => {
      const base = prev ?? storedModules;
      return { ...base, [key]: !base[key] };
    });
  };

  const save = () => {
    if (!selected || isSuperAdmin) return;
    const permissions: Record<string, boolean> = {};
    for (const m of MODULES) {
      if (!currentModules[m.key]) continue;
      for (const k of m.writes) permissions[k] = true;
    }
    saveMutation.mutate({ id: String(selected.id), permissions });
  };

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Roles &amp; RBAC</h2>
        <p className="text-muted-foreground">
          Module access for the platform's own admin roles. Restaurant staff roles are separate and are managed inside each restaurant.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {roles.map((role: any) => {
          const Icon = ICONS[role.name] ?? Users;
          return (
            <Card key={role.id} className={`cursor-pointer transition-all ${String(selected?.id) === String(role.id) ? "border-primary ring-1 ring-primary/20" : ""}`} onClick={() => { setSelectedId(String(role.id)); setLocalModules(null); }}>
              <CardHeader className="pb-2">
                <Icon className={`h-5 w-5 ${role.isSystem ? "text-primary" : "text-muted-foreground"}`} />
                <CardTitle className="text-lg mt-2">{role.name}</CardTitle>
                <CardDescription className="text-xs">{role.description ?? "Platform role"}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
      {selected && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>{selected.name} Permissions</CardTitle>
              <CardDescription>
                {isSuperAdmin
                  ? "Super Admin always has every module. This role is not editable."
                  : "Grant extra modules on top of the role's built-in access, then save."}
              </CardDescription>
            </div>
            <Button disabled={saveMutation.isPending || isSuperAdmin || !dirty} onClick={save}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {MODULES.map(m => {
              const locked = isSuperAdmin || baseline.has(m.key);
              return (
                <div key={m.key} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.label}</span>
                      {!isSuperAdmin && baseline.has(m.key) && (
                        <Badge variant="secondary" className="text-[10px] gap-1"><Lock className="h-2.5 w-2.5" /> Built in</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  <Switch
                    checked={isSuperAdmin || baseline.has(m.key) || !!currentModules[m.key]}
                    onCheckedChange={() => toggleModule(m.key)}
                    disabled={locked}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
