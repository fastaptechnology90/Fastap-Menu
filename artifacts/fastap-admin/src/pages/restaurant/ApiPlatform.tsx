import { useState, useEffect } from "react";
import { Key, Copy, RefreshCw, Code, Check, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function ApiPlatform() {
  const { restaurantId } = useRestaurant();
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    platformApi.apiKeys(restaurantId).then(setData).catch(e => toast({ title: "Could not load your API keys", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
  };

  useEffect(load, [restaurantId]);

  async function regenerate() {
    if (!restaurantId) return;
    setRegenerating(true);
    const d = await platformApi.regenerateApiKey(restaurantId).catch(() => null);
    if (d) setData((prev: any) => ({ ...prev, ...d }));
    else load();
    setRegenerating(false);
  }

  function copyKey() {
    if (!data?.apiKey) return;
    // Clipboard access is blocked outside a secure context and in some browsers.
    navigator.clipboard.writeText(data.apiKey).catch(() => {
      toast({ title: "Could not copy the key", description: "Select it and copy manually.", variant: "destructive" });
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader className="h-4 w-4 animate-spin" />Loading API platform…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">API & Integration Platform</h1>
        <p className="text-xs text-muted-foreground">POS, payments, WhatsApp, SMS & accounting APIs</p>
      </div>

      <div className="rounded-lg bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Restaurant API Key</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 bg-foreground/40 border border-border rounded-lg px-4 py-3 text-sm font-mono text-success break-all">{data.apiKey}</code>
          <div className="flex gap-2">
            <button onClick={copyKey} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold flex items-center gap-1">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              Copy
            </button>
            <button onClick={regenerate} disabled={regenerating} className="px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} /> Rotate
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Rate limit: {data.rateLimit} · Created {data.keyCreatedAt ? new Date(data.keyCreatedAt).toLocaleDateString() : "—"}</p>
      </div>

      <div className="rounded-lg bg-card border border-border p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><Code className="h-4 w-4 text-muted-foreground" /> Available Endpoints</h3>
        <div className="space-y-2">
          {(data.endpoints || []).map((ep: any) => (
            <div key={ep.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted">
              <p className="text-sm font-semibold sm:w-32">{ep.label}</p>
              <code className="text-xs text-primary flex-1">{ep.path}</code>
              <span className="text-xs text-muted-foreground">{(ep.methods || []).join(", ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
