import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { Bell, Save, Mail, MessageSquare, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const channelIcon: Record<string, typeof Mail> = { email: Mail, sms: Smartphone, whatsapp: MessageSquare, push: Bell };

export default function AlertEngine() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["alert-rules"], queryFn: api.alerts.get });
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => { if (data?.rules) setRules(data.rules); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.alerts.save({ rules, recentAlerts: data?.recentAlerts ?? [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alert-rules"] }); toast.success("Alert rules saved"); },
    onError: () => toast.error("Save failed"),
  });

  return (
    <PageShell
      title="Alert Engine"
      description="Multi-channel alerts for payments, fraud, settlements, and infrastructure events."
      icon={<Bell className="h-6 w-6" />}
      accent="amber"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-xl"><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <div className="grid gap-3">
        {rules.map((r, i) => {
          const Icon = channelIcon[r.channel] ?? Bell;
          return (
            <div key={r.id} className="admin-card-elevated flex items-center justify-between p-4 gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs capitalize">{r.channel}</Badge>
                    <span className="text-xs text-muted-foreground">Threshold: {r.threshold}</span>
                  </div>
                </div>
              </div>
              <Switch checked={r.enabled} onCheckedChange={v => setRules(prev => prev.map((x, j) => j === i ? { ...x, enabled: v } : x))} />
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
