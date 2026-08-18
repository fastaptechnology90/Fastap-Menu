import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Shield, Users, Wallet, Settings, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";

const ICONS: Record<string, typeof Shield> = {
  "Super Admin": Shield,
  "Finance Admin": Wallet,
  "Support Admin": Users,
  "Compliance Admin": Settings,
};

const ALL_PERMISSIONS = [
  "Manage Vendors", "Approve KYC", "Process Refunds", "Release Settlements",
  "Manage Escrow", "Configure Taxes", "Edit System Settings", "Manage API Keys",
  "View Audit Logs", "Fraud Control",
];

function permKey(label: string) {
  return label.toLowerCase().replace(/\s+/g, "_");
}

export default function Roles() {
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useQuery({ queryKey: ["platform-roles"], queryFn: api.roles.list });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roles.find((r: any) => String(r.id) === selectedId) ?? roles[0];

  const saveMutation = useMutation({
    mutationFn: (data: { id: string; permissions: Record<string, boolean> }) =>
      api.roles.update(data.id, { permissions: data.permissions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-roles"] });
      toast.success("Role permissions saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({});

  const currentPerms = selected
    ? { ...(selected.permissions as Record<string, boolean> ?? {}), ...localPerms }
    : {};

  const togglePermission = (perm: string) => {
    if (selected?.isSystem && selected?.name === "Super Admin") {
      toast.error("Super Admin permissions cannot be modified");
      return;
    }
    const key = permKey(perm);
    setLocalPerms(p => ({ ...p, [key]: !currentPerms[key] }));
  };

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Roles & RBAC</h2>
        <p className="text-muted-foreground">Platform roles stored in database with persistent permissions.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {roles.map((role: any) => {
          const Icon = ICONS[role.name] ?? Users;
          return (
            <Card key={role.id} className={`cursor-pointer transition-all ${String(selected?.id) === String(role.id) ? "border-primary ring-1 ring-primary/20" : ""}`} onClick={() => { setSelectedId(String(role.id)); setLocalPerms({}); }}>
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
              <CardDescription>Toggle access for this role</CardDescription>
            </div>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ id: String(selected.id), permissions: currentPerms })}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {ALL_PERMISSIONS.map(perm => (
              <div key={perm} className="flex items-center justify-between p-3 rounded-lg border">
                <span className="text-sm">{perm}</span>
                <Switch checked={!!currentPerms[permKey(perm)] || (selected.name === "Super Admin" && selected.isSystem)} onCheckedChange={() => togglePermission(perm)} disabled={selected.name === "Super Admin" && selected.isSystem} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
