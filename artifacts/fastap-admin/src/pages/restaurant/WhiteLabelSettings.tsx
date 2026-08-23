import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { restaurantApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Palette, Save, Check, Globe, Smartphone, Type, Image, Monitor } from "lucide-react";

const THEME_PRESETS = [
  { name: "Violet (Default)", primary: "#7c3aed", secondary: "#a78bfa", accent: "#f97316" },
  { name: "Ocean Blue", primary: "#0ea5e9", secondary: "#38bdf8", accent: "#f97316" },
  { name: "Emerald", primary: "#059669", secondary: "#34d399", accent: "#f59e0b" },
  { name: "Rose Gold", primary: "#e11d48", secondary: "#fb7185", accent: "#fbbf24" },
  { name: "Midnight", primary: "#1e293b", secondary: "#334155", accent: "#6366f1" },
  { name: "Amber", primary: "#d97706", secondary: "#fbbf24", accent: "#0ea5e9" },
];

const FONT_OPTIONS = ["Inter (Default)", "Poppins", "Roboto", "Montserrat", "Playfair Display", "Lato"];

export default function WhiteLabelSettings() {
  const { restaurantId, restaurant } = useRestaurant();
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"branding" | "domain" | "menu" | "app">("branding");

  useEffect(() => {
    if (!restaurantId) return;
    restaurantApi.whiteLabel(restaurantId).then(r => {
      setSettings({
        restaurant_name: r.restaurant_name || r.name || "",
        logo_url: r.logo_url || r.logoUrl || "",
        favicon_url: r.favicon_url || "",
        primary_color: r.primary_color || "#7c3aed",
        secondary_color: r.secondary_color || "#a78bfa",
        accent_color: r.accent_color || "#f97316",
        font_family: r.font_family || "Inter (Default)",
        custom_domain: r.custom_domain || r.customDomain || "",
        custom_domain_status: r.custom_domain_status || "not_configured",
        menu_bg: r.menu_bg || "dark",
        show_powered_by: r.show_powered_by ?? true,
        header_text: r.header_text || r.restaurant_name || "Welcome",
        footer_text: r.footer_text || "Powered by Fastap",
        social_instagram: r.social_instagram || "",
        social_facebook: r.social_facebook || "",
        app_name: r.app_name || r.restaurant_name || "",
        splash_bg: r.splash_bg || "#7c3aed",
        ...r,
      });
    }).catch((e: any) => {
      toast({ variant: "destructive", title: "Could not load settings", description: e?.message || "Failed to load white-label settings." });
    }).finally(() => setLoading(false));
  }, [restaurantId]);

  async function handleSave() {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await restaurantApi.saveWhiteLabel(restaurantId, settings);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      toast({ title: "White-label settings saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || "Could not save white-label settings." });
    } finally {
      setSaving(false);
    }
  }

  function applyPreset(preset: typeof THEME_PRESETS[0]) {
    setSettings((p: any) => ({ ...p, primary_color: preset.primary, secondary_color: preset.secondary, accent_color: preset.accent }));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg"><Palette className="h-6 w-6 text-violet-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">White Label Settings</h1>
            <p className="text-slate-400 text-sm">Customize branding, colors, domain, and app appearance</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {saved ? "Saved!" : saving ? "Saving..." : "Save All"}
        </button>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit border border-slate-700/50">
        {(["branding", "domain", "menu", "app"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>{t}</button>
        ))}
      </div>

      {tab === "branding" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Identity</h3>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Restaurant / Brand Name</label>
              <input value={settings.restaurant_name || ""} onChange={e => setSettings((p: any) => ({ ...p, restaurant_name: e.target.value }))} className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Logo URL</label>
              <input value={settings.logo_url || ""} onChange={e => setSettings((p: any) => ({ ...p, logo_url: e.target.value }))} placeholder="https://..." className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Favicon URL</label>
              <input value={settings.favicon_url || ""} onChange={e => setSettings((p: any) => ({ ...p, favicon_url: e.target.value }))} placeholder="https://..." className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Font Family</label>
              <select value={settings.font_family || "Inter (Default)"} onChange={e => setSettings((p: any) => ({ ...p, font_family: e.target.value }))} className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none">
                {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Theme Colors</h3>
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map(p => (
                <button key={p.name} onClick={() => applyPreset(p)} className={`p-3 rounded-lg border text-left transition-all ${settings.primary_color === p.primary ? "border-white/40 bg-slate-700" : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600"}`}>
                  <div className="flex gap-1.5 mb-1.5">
                    {[p.primary, p.secondary, p.accent].map(c => <div key={c} className="w-4 h-4 rounded-full" style={{ background: c }} />)}
                  </div>
                  <div className="text-xs text-slate-300">{p.name}</div>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[["Primary", "primary_color"], ["Secondary", "secondary_color"], ["Accent", "accent_color"]].map(([l, f]) => (
                <div key={f}>
                  <label className="text-xs text-slate-400 mb-1 block">{l}</label>
                  <input type="color" value={settings[f] || "#7c3aed"} onChange={e => setSettings((p: any) => ({ ...p, [f]: e.target.value }))} className="h-9 w-full rounded-lg bg-slate-700 border border-slate-600 cursor-pointer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "domain" && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="h-5 w-5 text-violet-400" />
              <h3 className="font-semibold text-white">Custom Domain</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Custom Domain (e.g. menu.yourrestaurant.com)</label>
                <input value={settings.custom_domain || ""} onChange={e => setSettings((p: any) => ({ ...p, custom_domain: e.target.value }))} placeholder="menu.yourrestaurant.com" className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                <strong>DNS Setup:</strong> Add a CNAME record pointing your domain to <code className="bg-black/20 px-1 rounded">menu.fastapmenu.com</code>. Contact support for SSL setup.
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className={`w-2 h-2 rounded-full ${settings.custom_domain_status === "active" ? "bg-green-400" : "bg-yellow-400"}`} />
                Status: {settings.custom_domain_status === "active" ? "Active" : "Not Configured"}
              </div>
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="h-5 w-5 text-blue-400" />
              <h3 className="font-semibold text-white">SEO & Social</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Instagram Handle</label>
                <input value={settings.social_instagram || ""} onChange={e => setSettings((p: any) => ({ ...p, social_instagram: e.target.value }))} placeholder="@yourrestaurant" className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Facebook Page URL</label>
                <input value={settings.social_facebook || ""} onChange={e => setSettings((p: any) => ({ ...p, social_facebook: e.target.value }))} placeholder="https://facebook.com/..." className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
              </div>
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                <span className="text-sm text-slate-300">Show "Powered by Fastap" footer</span>
                <button onClick={() => setSettings((p: any) => ({ ...p, show_powered_by: !p.show_powered_by }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_powered_by ? "bg-violet-600" : "bg-slate-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.show_powered_by ? "translate-x-5" : ""}`} />
                </button>
              </label>
            </div>
          </div>
        </div>
      )}

      {tab === "menu" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-4">
            <h3 className="font-semibold text-white">Menu Appearance</h3>
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Menu Theme</label>
              <div className="grid grid-cols-2 gap-3">
                {["dark", "light", "colorful", "minimal"].map(t => (
                  <button key={t} onClick={() => setSettings((p: any) => ({ ...p, menu_bg: t }))} className={`p-3 rounded-lg border capitalize text-sm transition-all ${settings.menu_bg === t ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Header Text</label>
              <input value={settings.header_text || ""} onChange={e => setSettings((p: any) => ({ ...p, header_text: e.target.value }))} className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Footer Text</label>
              <input value={settings.footer_text || ""} onChange={e => setSettings((p: any) => ({ ...p, footer_text: e.target.value }))} className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
            </div>
          </div>
        </div>
      )}

      {tab === "app" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50 space-y-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-violet-400" />
              <h3 className="font-semibold text-white">Mobile App Branding</h3>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">App Name</label>
              <input value={settings.app_name || ""} onChange={e => setSettings((p: any) => ({ ...p, app_name: e.target.value }))} className="w-full bg-slate-700/50 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-violet-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Splash Screen Background</label>
              <input type="color" value={settings.splash_bg || "#7c3aed"} onChange={e => setSettings((p: any) => ({ ...p, splash_bg: e.target.value }))} className="h-10 w-full rounded-lg bg-slate-700 border border-slate-600 cursor-pointer" />
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-300">
              App branding is applied to Android and iOS builds. Contact support to generate custom app builds with your branding.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
