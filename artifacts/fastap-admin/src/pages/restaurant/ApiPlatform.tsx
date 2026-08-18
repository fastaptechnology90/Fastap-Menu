import { useState, useEffect } from "react";
import { Key, Copy, RefreshCw, Code, Check, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";

export default function ApiPlatform() {
  const { restaurantId } = useRestaurant();
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    platformApi.apiKeys(restaurantId).then(setData).catch(() => {});
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
    navigator.clipboard.writeText(data.apiKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) {
    return <div className="p-6 flex items-center gap-2 text-white/40"><Loader className="h-4 w-4 animate-spin" />Loading API platform…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">API & Integration Platform</h1>
        <p className="text-xs text-white/40">POS, payments, WhatsApp, SMS & accounting APIs</p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-amber-400" />
          <h3 className="font-bold">Restaurant API Key</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-emerald-300 break-all">{data.apiKey}</code>
          <div className="flex gap-2">
            <button onClick={copyKey} className="px-4 py-2 rounded-xl border border-white/10 text-sm font-semibold flex items-center gap-1">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              Copy
            </button>
            <button onClick={regenerate} disabled={regenerating} className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} /> Rotate
            </button>
          </div>
        </div>
        <p className="text-xs text-white/40">Rate limit: {data.rateLimit} · Created {data.keyCreatedAt ? new Date(data.keyCreatedAt).toLocaleDateString() : "—"}</p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
        <h3 className="font-bold flex items-center gap-2 mb-4"><Code className="h-4 w-4 text-violet-400" /> Available Endpoints</h3>
        <div className="space-y-2">
          {(data.endpoints || []).map((ep: any) => (
            <div key={ep.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-white/5">
              <p className="text-sm font-semibold sm:w-32">{ep.label}</p>
              <code className="text-xs text-amber-300/80 flex-1">{ep.path}</code>
              <span className="text-xs text-white/40">{(ep.methods || []).join(", ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
