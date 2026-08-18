import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageShell, PanelCard } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/apiClient";
import { Rocket, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function FeatureReleases() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["feature-releases"], queryFn: api.featureReleases.get });
  const [releases, setReleases] = useState<any[]>([]);

  useEffect(() => { if (data?.releases) setReleases(data.releases); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.featureReleases.save({ releases }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["feature-releases"] }); toast.success("Releases saved"); },
    onError: () => toast.error("Save failed"),
  });

  return (
    <PageShell
      title="Feature Release Management"
      description="Gradual rollouts, beta access, and vendor plan targeting."
      icon={<Rocket className="h-6 w-6" />}
      accent="violet"
      loading={isLoading}
      onRefresh={() => refetch()}
      refreshing={isFetching}
      actions={<Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-xl"><Save className="mr-2 h-4 w-4" /> Save</Button>}
    >
      <div className="grid gap-4">
        {releases.map((r, i) => (
          <PanelCard key={r.id} title={r.name} action={<Badge variant="outline" className="capitalize">{r.status}</Badge>}>
            <div className="grid gap-3 sm:grid-cols-2 mt-1">
              <div>
                <label className="text-xs text-muted-foreground">Rollout %</label>
                <Input value={r.rollout} onChange={e => setReleases(prev => prev.map((x, j) => j === i ? { ...x, rollout: e.target.value } : x))} className="h-9 mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Target Plans</label>
                <Input value={r.vendors} onChange={e => setReleases(prev => prev.map((x, j) => j === i ? { ...x, vendors: e.target.value } : x))} className="h-9 mt-1" placeholder="pro, enterprise" />
              </div>
            </div>
          </PanelCard>
        ))}
      </div>
    </PageShell>
  );
}
