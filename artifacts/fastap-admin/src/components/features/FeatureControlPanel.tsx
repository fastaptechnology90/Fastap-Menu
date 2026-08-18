import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2, Shield } from "lucide-react";

export type FeatureModuleRow = {
  number: number;
  key: string;
  title: string;
  category: string;
  linkedSystems?: number[];
  enabled: boolean;
  source: string;
  blockedBy?: number[];
  minPlan?: string;
  adminOverride?: boolean | null;
  restaurantToggle?: boolean | null;
  canToggle?: boolean;
  restaurantPaths?: string[];
};

type FeatureControlPanelProps = {
  title: string;
  description: string;
  modules: FeatureModuleRow[];
  loading?: boolean;
  mode: "superadmin" | "restaurant";
  onSave: (changes: Record<string, boolean>) => Promise<void>;
};

export function FeatureControlPanel({
  title,
  description,
  modules,
  loading,
  mode,
  onSave,
}: FeatureControlPanelProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        String(m.number).includes(q),
    );
  }, [modules, search]);

  const categories = useMemo(
    () => [...new Set(filtered.map((m) => m.category))].sort(),
    [filtered],
  );

  const stats = useMemo(() => {
    const operational = modules.filter((m) => m.number >= 2);
    const enabledCount = operational.filter((m) => {
      if (m.key in pending) return pending[m.key];
      if (mode === "superadmin") {
        if (m.adminOverride === true) return true;
        if (m.adminOverride === false) return false;
      } else if (m.restaurantToggle === false) {
        return false;
      }
      return m.enabled;
    }).length;
    return { enabledCount, total: operational.length };
  }, [modules, pending, mode]);

  function isOn(mod: FeatureModuleRow): boolean {
    if (mod.key in pending) return pending[mod.key];
    if (mode === "superadmin") {
      if (mod.adminOverride === true) return true;
      if (mod.adminOverride === false) return false;
    } else if (mod.restaurantToggle === false) {
      return false;
    }
    return mod.enabled;
  }

  function toggle(mod: FeatureModuleRow, next: boolean) {
    if (mode === "restaurant" && mod.canToggle === false) {
      toast({
        title: "Not available on your plan",
        description: "Contact your platform admin to enable this module.",
        variant: "destructive",
      });
      return;
    }
    setPending((prev) => ({ ...prev, [mod.key]: next }));
  }

  async function handleSave() {
    if (Object.keys(pending).length === 0) return;
    setSaving(true);
    try {
      await onSave(pending);
      setPending({});
      toast({ title: "Feature controls saved" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>
              {description}
              {stats.total > 0 && (
                <span className="block mt-1 text-foreground/80">
                  {stats.enabledCount} of {stats.total} modules enabled
                  {Object.keys(pending).length > 0
                    ? ` · ${Object.keys(pending).length} unsaved change(s)`
                    : ""}
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Search modules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48"
            />
            <Button
              onClick={handleSave}
              disabled={saving || Object.keys(pending).length === 0}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={categories[0] ?? "All"}>
          <TabsList className="flex-wrap h-auto mb-4">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-2">
              {filtered
                .filter((m) => m.category === cat)
                .map((mod) => (
                  <div
                    key={mod.key}
                    className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">
                          #{mod.number} · {mod.title}
                        </span>
                        <Badge variant={isOn(mod) ? "default" : "secondary"}>
                          {isOn(mod) ? "On" : "Off"}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {mod.source}
                        </Badge>
                        {mod.minPlan ? (
                          <Badge variant="outline" className="text-xs">
                            {mod.minPlan}+
                          </Badge>
                        ) : null}
                      </div>
                      {(mod.linkedSystems?.length ?? 0) > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          Linked: {mod.linkedSystems!.map((n) => `#${n}`).join(", ")}
                        </p>
                      )}
                      {mod.blockedBy && mod.blockedBy.length > 0 && (
                        <p className="text-xs text-amber-500 mt-1">
                          Blocked — requires: {mod.blockedBy.map((n) => `#${n}`).join(", ")}
                        </p>
                      )}
                      {mod.restaurantPaths && mod.restaurantPaths.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Panel: {mod.restaurantPaths.join(", ")}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={isOn(mod)}
                      onCheckedChange={(v) => toggle(mod, v)}
                      disabled={mode === "restaurant" && mod.canToggle === false}
                    />
                  </div>
                ))}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
