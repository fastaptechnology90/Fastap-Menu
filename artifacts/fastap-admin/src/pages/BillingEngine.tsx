import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { CreditCard, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function BillingEngine() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["billing-rules"], queryFn: api.billing.getRules });
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => { if (data?.models) setModels(data.models); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.billing.saveRules({ models }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billing-rules"] }); toast.success("Billing rules saved"); },
    onError: () => toast.error("Save failed"),
  });

  return (
    <PageShell
      title="Dynamic Pricing & Billing"
      description="Subscription, per-order, usage, and hybrid billing models for the platform."
      icon={<CreditCard className="h-6 w-6" />}
      accent="primary"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-xl">
          <Save className="mr-2 h-4 w-4" /> Save Rules
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {models.map((m, i) => (
          <PanelCard key={m.id} title={m.name} action={<Switch checked={m.enabled} onCheckedChange={v => setModels(prev => prev.map((x, j) => j === i ? { ...x, enabled: v } : x))} />}>
            <p className="text-sm text-muted-foreground">{m.description}</p>
            {m.rate != null && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">Rate</Badge>
                <span className="font-semibold">{m.rate} {m.unit}</span>
              </div>
            )}
          </PanelCard>
        ))}
      </div>
    </PageShell>
  );
}
