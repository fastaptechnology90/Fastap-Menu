import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Monitor, Plus, Trash2, Edit2, Save, ToggleLeft, ToggleRight, Tv, Wifi, WifiOff, Settings, GripVertical, ChevronUp, ChevronDown, Check } from "lucide-react";

const API_BASE = "/api";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SLIDE_TYPES = [
  { value: "banner", label: "Welcome Banner" },
  { value: "promo", label: "Promotion" },
  { value: "menu", label: "Menu Highlight" },
  { value: "social", label: "Social Media" },
];

const BG_PRESETS = ["#7c3aed", "#f97316", "#0f172a", "#1e293b", "#dc2626", "#16a34a", "#0891b2", "#c2410c"];

export default function DigitalSignage() {
  const { restaurantId } = useRestaurant();
  const [data, setData] = useState<any>({ settings: {}, slides: [], screens: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"slides" | "screens" | "settings">("slides");
  const [editSlide, setEditSlide] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newSlide, setNewSlide] = useState({ type: "banner", title: "", subtitle: "", bg_color: "#7c3aed", text_color: "#ffffff", active: true });
  const [saving, setSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    if (!restaurantId) return;
    apiFetch(`/restaurants/${restaurantId}/signage`)
      .then(d => {
        const normalized = {
          settings: d?.settings ?? {},
          slides: Array.isArray(d?.slides) ? d.slides : [],
          screens: Array.isArray(d?.screens) ? d.screens : [],
        };
        setData(normalized);
        setSettings(normalized.settings);
      })
      .catch(() => {
        setData({ settings: {}, slides: [], screens: [] });
      })
      .finally(() => setLoading(false));
  }, [restaurantId]);

  async function handleToggleSlide(id: number, active: boolean) {
    if (!restaurantId) return;
    await apiFetch(`/restaurants/${restaurantId}/signage/slides/${id}`, { method: "PUT", body: JSON.stringify({ active }) });
    setData((prev: any) => ({ ...prev, slides: prev.slides.map((s: any) => s.id === id ? { ...s, active } : s) }));
  }

  async function handleDeleteSlide(id: number) {
    if (!restaurantId) return;
    await apiFetch(`/restaurants/${restaurantId}/signage/slides/${id}`, { method: "DELETE" });
    setData((prev: any) => ({ ...prev, slides: prev.slides.filter((s: any) => s.id !== id) }));
  }

  async function handleAddSlide() {
    if (!restaurantId || !newSlide.title) return;
    const slide = await apiFetch(`/restaurants/${restaurantId}/signage/slides`, { method: "POST", body: JSON.stringify(newSlide) });
    setData((prev: any) => ({ ...prev, slides: [...prev.slides, slide] }));
    setShowAdd(false); setNewSlide({ type: "banner", title: "", subtitle: "", bg_color: "#7c3aed", text_color: "#ffffff", active: true });
  }

  async function handleSaveSlide() {
    if (!restaurantId || !editSlide) return;
    await apiFetch(`/restaurants/${restaurantId}/signage/slides/${editSlide.id}`, { method: "PUT", body: JSON.stringify(editSlide) });
    setData((prev: any) => ({ ...prev, slides: prev.slides.map((s: any) => s.id === editSlide.id ? editSlide : s) }));
    setEditSlide(null);
  }

  async function handleSaveSettings() {
    if (!restaurantId) return;
    setSaving(true);
    await apiFetch(`/restaurants/${restaurantId}/signage/settings`, { method: "PUT", body: JSON.stringify(settings) }).catch(() => {});
    setSaving(false); setSavedSettings(true); setTimeout(() => setSavedSettings(false), 2000);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg"><Tv className="h-6 w-6 text-violet-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Digital Signage</h1>
            <p className="text-slate-400 text-sm">Manage TV displays, menu boards, and promotional screens</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${data.settings?.enabled ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.settings?.enabled ? "bg-green-400" : "bg-red-400"}`} />
            {data.settings?.enabled ? "Display Active" : "Display Off"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label: "Total Slides", value: (data.slides ?? []).length }, { label: "Active Slides", value: (data.slides ?? []).filter((s: any) => s.active).length }, { label: "Connected Screens", value: (data.screens ?? []).filter((s: any) => s.status === "online").length + "/" + (data.screens ?? []).length }].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit border border-slate-700/50">
        {(["slides", "screens", "settings"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>{t}</button>
        ))}
      </div>

      {tab === "slides" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> Add Slide</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data.slides ?? []).map((slide: any) => (
              <div key={slide.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="h-28 flex items-center justify-center relative" style={{ background: slide.bg_color || "#1e293b" }}>
                  <div className="text-center px-4">
                    <div className="text-lg font-bold" style={{ color: slide.text_color || "#fff" }}>{slide.title}</div>
                    <div className="text-xs mt-1 opacity-75" style={{ color: slide.text_color || "#fff" }}>{slide.subtitle}</div>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${slide.active ? "bg-green-500/80 text-white" : "bg-gray-500/80 text-white"}`}>{slide.active ? "Active" : "Paused"}</span>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-300 capitalize">{slide.type}</div>
                    <div className="text-xs text-slate-500">Order: {slide.order}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleToggleSlide(slide.id, !slide.active)} className={`p-1.5 rounded-lg transition-colors ${slide.active ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}>
                      {slide.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditSlide(slide)} className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDeleteSlide(slide.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "screens" && (
        <div className="space-y-3">
          {(data.screens ?? []).map((screen: any) => (
            <div key={screen.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg ${screen.status === "online" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                {screen.status === "online" ? <Wifi className="h-5 w-5 text-green-400" /> : <WifiOff className="h-5 w-5 text-red-400" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">{screen.name}</div>
                <div className="text-xs text-slate-400">{screen.location} • {screen.resolution}</div>
                <div className="text-xs text-slate-500">Last ping: {new Date(screen.last_ping).toLocaleTimeString()}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${screen.status === "online" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{screen.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "settings" && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 space-y-5 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
              <span className="text-sm text-slate-300">Display Enabled</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, enabled: !p.enabled }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.enabled ? "bg-violet-600" : "bg-slate-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.enabled ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
              <span className="text-sm text-slate-300">Show Prices</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, show_prices: !p.show_prices }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_prices ? "bg-violet-600" : "bg-slate-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.show_prices ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
              <span className="text-sm text-slate-300">Show Images</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, show_images: !p.show_images }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_images ? "bg-violet-600" : "bg-slate-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.show_images ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
              <span className="text-sm text-slate-300">Show Promotions</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, show_promotions: !p.show_promotions }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_promotions ? "bg-violet-600" : "bg-slate-600"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.show_promotions ? "translate-x-5" : ""}`} />
              </button>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Rotation Speed (seconds)</label>
              <input type="number" value={settings.rotation_speed || 10} onChange={e => setSettings((p: any) => ({ ...p, rotation_speed: parseInt(e.target.value) }))} className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-violet-500 outline-none" min={5} max={60} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Font Size</label>
              <select value={settings.font_size || "medium"} onChange={e => setSettings((p: any) => ({ ...p, font_size: e.target.value }))} className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-violet-500 outline-none">
                <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
              </select>
            </div>
          </div>
          <button onClick={handleSaveSettings} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
            {savedSettings ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {savedSettings ? "Saved!" : saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {(showAdd || editSlide) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">{editSlide ? "Edit Slide" : "New Slide"}</h3>
            <div className="space-y-3">
              {[{ label: "Type", field: "type", type: "select", options: SLIDE_TYPES }, { label: "Title", field: "title", type: "text" }, { label: "Subtitle", field: "subtitle", type: "text" }].map(f => (
                <div key={f.field}>
                  <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                  {f.type === "select" ? (
                    <select value={(editSlide || newSlide)[f.field]} onChange={e => editSlide ? setEditSlide((p: any) => ({ ...p, [f.field]: e.target.value })) : setNewSlide(p => ({ ...p, [f.field]: e.target.value }))} className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-violet-500 outline-none">
                      {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input value={(editSlide || newSlide)[f.field] || ""} onChange={e => editSlide ? setEditSlide((p: any) => ({ ...p, [f.field]: e.target.value })) : setNewSlide(p => ({ ...p, [f.field]: e.target.value }))} className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-violet-500 outline-none" />
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Background Color</label>
                <div className="flex gap-2 flex-wrap">
                  {BG_PRESETS.map(c => <button key={c} onClick={() => editSlide ? setEditSlide((p: any) => ({ ...p, bg_color: c })) : setNewSlide(p => ({ ...p, bg_color: c }))} className="w-8 h-8 rounded-lg border-2 transition-all" style={{ background: c, borderColor: (editSlide || newSlide).bg_color === c ? "#fff" : "transparent" }} />)}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setEditSlide(null); }} className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">Cancel</button>
              <button onClick={editSlide ? handleSaveSlide : handleAddSlide} className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">{editSlide ? "Save" : "Add Slide"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
