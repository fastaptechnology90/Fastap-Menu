import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/apiClient";
import { FlaskConical, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function AdminSandbox() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["sandbox"], queryFn: api.sandbox.get });
  const [config, setConfig] = useState<Record<string, unknown>>({});

  useEffect(() => { if (data) setConfig(data); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.sandbox.save(config),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sandbox"] }); toast.success("Sandbox config saved"); },
    onError: () => toast.error("Save failed"),
  });

  const toggles = [
    { key: "enabled", label: "Sandbox Enabled", desc: "Isolate test traffic from production" },
    { key: "demoPayments", label: "Demo Payments", desc: "Simulate payment flows without charges" },
    { key: "featureFlagsBeta", label: "Beta Features", desc: "Enable experimental features in sandbox" },
  ];

  return (
    <PageShell
      title="Platform Sandbox"
      description="Test environment, demo payments, and beta feature flags for safe experimentation."
      icon={<FlaskConical className="h-6 w-6" />}
      accent="violet"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-xl"><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <PanelCard title="Sandbox Configuration">
        <div className="space-y-1">
          {toggles.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-4 border-b last:border-0 gap-4">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <Switch checked={!!config[key]} onCheckedChange={v => setConfig(c => ({ ...c, [key]: v }))} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-3">API Base: <code className="bg-muted px-1.5 py-0.5 rounded">{String(config.apiBase ?? "/api")}</code></p>
        </div>
      </PanelCard>
    </PageShell>
  );
}
