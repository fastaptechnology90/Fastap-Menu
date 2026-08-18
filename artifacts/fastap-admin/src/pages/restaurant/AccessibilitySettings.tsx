import { useState, useEffect } from "react";
import { Accessibility, Languages, Save, Check, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";

export default function AccessibilitySettings() {
  const { restaurantId } = useRestaurant();
  const [settings, setSettings] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    platformApi.accessibility(restaurantId).then(setSettings).catch(() => {});
  }, [restaurantId]);

  async function save() {
    if (!restaurantId || !settings) return;
    const { catalog, ...payload } = settings;
    await platformApi.updateAccessibility(restaurantId, payload).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) {
    return <div className="p-6 flex items-center gap-2 text-white/40"><Loader className="h-4 w-4 animate-spin" />Loading accessibility settings…</div>;
  }

  const langs = settings.catalog?.languages || [
    { code: "en", label: "English" },
    { code: "hi", label: "Hindi" },
  ];

  const toggles = [
    { key: "largeTextDefault", label: "Large text mode (default for guest menu)" },
    { key: "highContrastDefault", label: "High contrast mode" },
    { key: "voiceMenuDefault", label: "Voice menu enabled" },
    { key: "screenReaderHints", label: "Screen reader hints" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Accessibility & Languages</h1>
          <p className="text-xs text-white/40">Guest menu defaults — Hindi, English & regional languages</p>
        </div>
        <button onClick={save} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-bold">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Languages className="h-4 w-4 text-blue-400" /> Default Language</h3>
        <select
          value={settings.defaultLanguage || "en"}
          onChange={e => setSettings((s: any) => ({ ...s, defaultLanguage: e.target.value }))}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm max-w-xs"
        >
          {langs.map((l: any) => <option key={l.code} value={l.code}>{l.label || l.name || l.code}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {(settings.enabledLanguages || ["en", "hi"]).map((code: string) => {
            const label = langs.find((l: any) => l.code === code)?.label || code;
            return (
              <span key={code} className="text-xs px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20">{label}</span>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Accessibility className="h-4 w-4 text-violet-400" /> Guest Defaults</h3>
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span className="text-sm">{t.label}</span>
            <button
              onClick={() => setSettings((s: any) => ({ ...s, [t.key]: !s[t.key] }))}
              className={`h-7 w-12 rounded-full ${settings[t.key] ? "bg-violet-500" : "bg-white/20"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${settings[t.key] ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
