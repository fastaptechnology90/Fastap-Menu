import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { FeatureControlPanel } from "@/components/features/FeatureControlPanel";
import { featuresApi } from "@/lib/api";

export default function FeatureControl() {
  const { restaurant, refreshFeaturePaths } = useRestaurant();
  const qc = useQueryClient();
  const rid = restaurant?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["restaurant-features", rid],
    queryFn: () => featuresApi.getRestaurant(rid!),
    enabled: !!rid,
  });

  const saveMutation = useMutation({
    mutationFn: (toggles: Record<string, boolean>) =>
      featuresApi.setRestaurant(rid!, toggles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-features", rid] });
    },
  });

  if (!rid) return null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <FeatureControlPanel
        title="Kitchen & operations modules"
        description="Enable or disable modules for your restaurant. Changes sync to the mobile kitchen app and linked panel sections. Modules blocked by plan or admin cannot be turned on here."
        mode="restaurant"
        loading={isLoading}
        modules={data?.modules ?? []}
        onSave={async (changes) => {
          await saveMutation.mutateAsync(changes);
          await refreshFeaturePaths();
        }}
      />
      {data?.enabledRestaurantPaths && (
        <p className="text-xs text-muted-foreground px-1">
          Active panel routes: {data.enabledRestaurantPaths.length} modules linked
        </p>
      )}
    </div>
  );
}
