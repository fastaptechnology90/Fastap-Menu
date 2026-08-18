import { useState, useEffect } from "react";
import { FlaskConical, Save, Check, CreditCard, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";

export default function SandboxDemo() {
  const { restaurantId, restaurant } = useRestaurant();
  const [settings, setSettings] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    platformApi.sandbox(restaurantId).then(setSettings).catch(() => {});
  }, [restaurantId]);

  async function save() {
    if (!restaurantId || !settings) return;
    await platformApi.updateSandbox(restaurantId, settings).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) {
    return <div className="p-6 flex items-center gap-2 text-white/40"><Loader className="h-4 w-4 animate-spin" />Loading sandbox…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Sandbox / Demo Environment</h1>
          <p className="text-xs text-white/40">Test payments & trial restaurant without affecting live data</p>
        </div>
        <button onClick={save} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-bold">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className={`rounded-2xl border p-5 ${settings.environment === "sandbox" ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.03] border-white/8"}`}>
        <div className="flex items-center gap-3 mb-4">
          <FlaskConical className="h-6 w-6 text-violet-400" />
          <div>
            <p className="font-bold">Environment: {settings.environment === "sandbox" ? "Sandbox" : "Production"}</p>
            <p className="text-xs text-white/40">Venue: {restaurant.name}</p>
          </div>
        </div>
        <button
          onClick={() => setSettings((s: any) => ({ ...s, environment: s.environment === "sandbox" ? "production" : "sandbox", enabled: s.environment !== "sandbox" }))}
          className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-300 text-sm font-semibold"
        >
          Switch to {settings.environment === "sandbox" ? "Production" : "Sandbox"}
        </button>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><CreditCard className="h-4 w-4 text-emerald-400" /> Test Payments</h3>
        {[
          { key: "demoPayments", label: "Demo payment mode" },
          { key: "testUpi", label: "Test UPI (no real charge)" },
          { key: "testCard", label: "Test card gateway" },
        ].map(t => (
          <div key={t.key} className="flex items-center justify-between">
            <span className="text-sm">{t.label}</span>
            <button
              onClick={() => setSettings((s: any) => ({ ...s, [t.key]: !s[t.key] }))}
              className={`h-7 w-12 rounded-full ${settings[t.key] ? "bg-emerald-500" : "bg-white/20"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${settings[t.key] ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
        <div>
          <label className="text-xs text-white/40">Demo restaurant slug</label>
          <input
            value={settings.trialRestaurantSlug || ""}
            onChange={e => setSettings((s: any) => ({ ...s, trialRestaurantSlug: e.target.value }))}
            className="mt-1 w-full max-w-sm bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
