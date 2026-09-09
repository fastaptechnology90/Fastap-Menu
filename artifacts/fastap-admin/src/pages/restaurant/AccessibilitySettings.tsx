import { useState, useEffect } from "react";
import { Accessibility, Languages, Save, Check, Loader, AlertCircle } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AccessibilitySettings() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    setLoadError(false);
    platformApi.accessibility(restaurantId).then(setSettings).catch((e: any) => {
      // Don't leave the page stuck on the spinner forever — surface an error state.
      setLoadError(true);
      toast({ variant: "destructive", title: "Could not load settings", description: e?.message || "Failed to load accessibility settings." });
    });
  }, [restaurantId]);

  async function save() {
    if (!restaurantId || !settings) return;
    const { catalog, ...payload } = settings;
    try {
      await platformApi.updateAccessibility(restaurantId, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: "Accessibility settings saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || "Could not save accessibility settings." });
    }
  }

  if (loadError && !settings) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-danger-subtle border border-danger-border p-5 flex items-start gap-3 max-w-lg">
          <AlertCircle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger">Couldn't load accessibility settings</p>
            <p className="text-xs text-muted-foreground mt-1">Check your connection and try again.</p>
            <button onClick={() => { setLoadError(false); if (restaurantId) platformApi.accessibility(restaurantId).then(setSettings).catch(() => setLoadError(true)); }} className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader className="h-4 w-4 animate-spin" />Loading accessibility settings…</div>;
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
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Accessibility & Languages</h1>
          <p className="text-xs text-muted-foreground">Guest menu defaults — Hindi, English & regional languages</p>
        </div>
        <button onClick={save} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <div className="rounded-lg bg-card border border-border p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Languages className="h-4 w-4 text-info" /> Default Language</h3>
        <select
          value={settings.defaultLanguage || "en"}
          onChange={e => setSettings((s: any) => ({ ...s, defaultLanguage: e.target.value }))}
          className="bg-muted border border-border rounded-lg px-3 py-2 text-sm max-w-xs"
        >
          {langs.map((l: any) => <option key={l.code} value={l.code}>{l.label || l.name || l.code}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {(settings.enabledLanguages || ["en", "hi"]).map((code: string) => {
            const label = langs.find((l: any) => l.code === code)?.label || code;
            return (
              <span key={code} className="text-xs px-3 py-1 rounded-full bg-info-subtle text-info border border-info-border">{label}</span>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg bg-card border border-border p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Accessibility className="h-4 w-4 text-muted-foreground" /> Guest Defaults</h3>
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <span className="text-sm">{t.label}</span>
            <button
              onClick={() => setSettings((s: any) => ({ ...s, [t.key]: !s[t.key] }))}
              className={`h-7 w-12 rounded-full ${settings[t.key] ? "bg-muted" : "bg-muted"}`}
            >
              <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${settings[t.key] ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
