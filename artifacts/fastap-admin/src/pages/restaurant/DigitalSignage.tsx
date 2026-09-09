import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";
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
  { value: "video", label: "Video (YouTube)" },
];

/**
 * Screens embed the player, so a watch/share link has to become an embed link — pasting
 * a plain youtube.com/watch URL into an iframe is refused by YouTube and shows a blank
 * screen in the dining room.
 */
function youtubeEmbedUrl(raw: string): string | null {
  const url = String(raw || "").trim();
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (!m) return null;
  return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}`;
}

const BG_PRESETS = ["#7c3aed", "#f97316", "#0f172a", "#1e293b", "#dc2626", "#16a34a", "#0891b2", "#c2410c"];

export default function DigitalSignage() {
  const { restaurantId } = useRestaurant();
  const [data, setData] = useState<any>({ settings: {}, slides: [], screens: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"slides" | "screens" | "settings">("slides");
  const [editSlide, setEditSlide] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newSlide, setNewSlide] = useState<any>({ type: "banner", title: "", subtitle: "", bg_color: "#7c3aed", text_color: "#ffffff", active: true, url: "", duration: 10 });
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

  // Every one of these used to run without a catch, so a rejected write threw into the
  // console and the screen list simply stayed as it was — silently out of step with what
  // the TVs were showing.
  async function handleToggleSlide(id: number, active: boolean) {
    if (!restaurantId) return;
    try {
      await apiFetch(`/restaurants/${restaurantId}/signage/slides/${id}`, { method: "PUT", body: JSON.stringify({ active }) });
      setData((prev: any) => ({ ...prev, slides: prev.slides.map((s: any) => s.id === id ? { ...s, active } : s) }));
    } catch (e) {
      toast({ title: "Could not change the slide", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleDeleteSlide(id: number) {
    if (!restaurantId) return;
    try {
      await apiFetch(`/restaurants/${restaurantId}/signage/slides/${id}`, { method: "DELETE" });
      setData((prev: any) => ({ ...prev, slides: prev.slides.filter((s: any) => s.id !== id) }));
      toast({ title: "Slide removed" });
    } catch (e) {
      toast({ title: "Could not remove the slide", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  /** Shared checks for both add and edit — a video slide is useless without a playable link. */
  function slideProblem(slide: any): string | null {
    if (!String(slide.title || "").trim()) return "Give the slide a title";
    if (slide.type === "video" && !youtubeEmbedUrl(slide.url)) {
      return "Paste a YouTube link — a full youtube.com/watch or youtu.be address";
    }
    return null;
  }

  async function handleAddSlide() {
    if (!restaurantId) return;
    const problem = slideProblem(newSlide);
    if (problem) { toast({ title: problem, variant: "destructive" }); return; }
    try {
      const slide = await apiFetch(`/restaurants/${restaurantId}/signage/slides`, { method: "POST", body: JSON.stringify(newSlide) });
      setData((prev: any) => ({ ...prev, slides: [...prev.slides, slide] }));
      setShowAdd(false);
      setNewSlide({ type: "banner", title: "", subtitle: "", bg_color: "#7c3aed", text_color: "#ffffff", active: true, url: "", duration: 10 });
      toast({ title: "Slide added" });
    } catch (e) {
      toast({ title: "Could not add the slide", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleSaveSlide() {
    if (!restaurantId || !editSlide) return;
    const problem = slideProblem(editSlide);
    if (problem) { toast({ title: problem, variant: "destructive" }); return; }
    try {
      await apiFetch(`/restaurants/${restaurantId}/signage/slides/${editSlide.id}`, { method: "PUT", body: JSON.stringify(editSlide) });
      setData((prev: any) => ({ ...prev, slides: prev.slides.map((s: any) => s.id === editSlide.id ? editSlide : s) }));
      setEditSlide(null);
      toast({ title: "Slide saved" });
    } catch (e) {
      toast({ title: "Could not save the slide", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleSaveSettings() {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await apiFetch(`/restaurants/${restaurantId}/signage/settings`, { method: "PUT", body: JSON.stringify(settings) });
    } catch (e) {
      toast({ title: "Signage settings not saved", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
      setSaving(false);
      return;
    }
    setSaving(false); setSavedSettings(true); setTimeout(() => setSavedSettings(false), 2000);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg"><Tv className="h-6 w-6 text-muted-foreground" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Digital Signage</h1>
            <p className="text-muted-foreground text-sm">Manage TV displays, menu boards, and promotional screens</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full ${data.settings?.enabled ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${data.settings?.enabled ? "bg-success" : "bg-danger"}`} />
            {data.settings?.enabled ? "Display Active" : "Display Off"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{ label: "Total Slides", value: (data.slides ?? []).length }, { label: "Active Slides", value: (data.slides ?? []).filter((s: any) => s.active).length }, { label: "Connected Screens", value: (data.screens ?? []).filter((s: any) => s.status === "online").length + "/" + (data.screens ?? []).length }].map(s => (
          <div key={s.label} className="bg-muted rounded-lg p-4 border border-border text-center">
            <div className="text-2xl font-semibold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit border border-border">
        {(["slides", "screens", "settings"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "slides" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-muted hover-elevate text-foreground rounded-lg text-sm font-medium transition-colors"><Plus className="h-4 w-4" /> Add Slide</button>
          </div>
          {(data.slides ?? []).length === 0 && (
            <EmptyState
              title="No slides yet"
              description="Add a slide and it starts playing on every screen paired with this venue."
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data.slides ?? []).map((slide: any) => (
              <div key={slide.id} className="bg-muted rounded-lg border border-border overflow-hidden">
                <div className="h-28 flex items-center justify-center relative" style={{ background: slide.bg_color || "#1e293b" }}>
                  <div className="text-center px-4">
                    <div className="text-lg font-semibold" style={{ color: slide.text_color || "#fff" }}>{slide.title}</div>
                    <div className="text-xs mt-1 opacity-75" style={{ color: slide.text_color || "#fff" }}>{slide.subtitle}</div>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${slide.active ? "bg-success-subtle text-foreground" : "bg-muted text-foreground"}`}>{slide.active ? "Active" : "Paused"}</span>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground capitalize">{slide.type}</div>
                    <div className="text-xs text-muted-foreground">Order: {slide.order}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleToggleSlide(slide.id, !slide.active)} className={`p-1.5 rounded-lg transition-colors ${slide.active ? "bg-success-subtle text-success hover-elevate" : "bg-muted text-muted-foreground hover-elevate"}`}>
                      {slide.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => setEditSlide(slide)} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover-elevate transition-colors"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDeleteSlide(slide.id)} className="p-1.5 rounded-lg bg-danger-subtle text-danger hover-elevate transition-colors"><Trash2 className="h-4 w-4" /></button>
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
            <div key={screen.id} className="bg-muted rounded-lg border border-border p-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg ${screen.status === "online" ? "bg-success-subtle" : "bg-danger-subtle"}`}>
                {screen.status === "online" ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-danger" />}
              </div>
              <div className="flex-1">
                <div className="font-medium text-foreground">{screen.name}</div>
                <div className="text-xs text-muted-foreground">{screen.location} • {screen.resolution}</div>
                <div className="text-xs text-muted-foreground">Last ping: {new Date(screen.last_ping).toLocaleTimeString()}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${screen.status === "online" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}>{screen.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "settings" && (
        <div className="bg-muted rounded-lg border border-border p-6 space-y-5 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <span className="text-sm text-muted-foreground">Display Enabled</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, enabled: !p.enabled }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.enabled ? "bg-muted" : "bg-muted"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.enabled ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <span className="text-sm text-muted-foreground">Show Prices</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, show_prices: !p.show_prices }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_prices ? "bg-muted" : "bg-muted"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.show_prices ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <span className="text-sm text-muted-foreground">Show Images</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, show_images: !p.show_images }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_images ? "bg-muted" : "bg-muted"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.show_images ? "translate-x-5" : ""}`} />
              </button>
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
              <span className="text-sm text-muted-foreground">Show Promotions</span>
              <button onClick={() => setSettings((p: any) => ({ ...p, show_promotions: !p.show_promotions }))} className={`relative w-10 h-5 rounded-full transition-colors ${settings.show_promotions ? "bg-muted" : "bg-muted"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.show_promotions ? "translate-x-5" : ""}`} />
              </button>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rotation Speed (seconds)</label>
              <input type="number" value={settings.rotation_speed || 10} onChange={e => setSettings((p: any) => ({ ...p, rotation_speed: parseInt(e.target.value) }))} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none" min={5} max={60} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Font Size</label>
              <select value={settings.font_size || "medium"} onChange={e => setSettings((p: any) => ({ ...p, font_size: e.target.value }))} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none">
                <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
              </select>
            </div>
          </div>
          <button onClick={handleSaveSettings} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-muted hover-elevate text-foreground rounded-lg text-sm font-medium transition-colors">
            {savedSettings ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {savedSettings ? "Saved!" : saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {(showAdd || editSlide) && (
        <div className="fixed inset-0 bg-foreground/40 z-50 flex items-center justify-center p-4">
          <div className="bg-muted rounded-lg p-6 w-full max-w-md border border-border max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">{editSlide ? "Edit Slide" : "New Slide"}</h3>
            <div className="space-y-3">
              {[{ label: "Type", field: "type", type: "select", options: SLIDE_TYPES }, { label: "Title", field: "title", type: "text" }, { label: "Subtitle", field: "subtitle", type: "text" }].map(f => (
                <div key={f.field}>
                  <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                  {f.type === "select" ? (
                    <select value={(editSlide || newSlide)[f.field]} onChange={e => editSlide ? setEditSlide((p: any) => ({ ...p, [f.field]: e.target.value })) : setNewSlide((p: any) => ({ ...p, [f.field]: e.target.value }))} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none">
                      {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input value={(editSlide || newSlide)[f.field] || ""} onChange={e => editSlide ? setEditSlide((p: any) => ({ ...p, [f.field]: e.target.value })) : setNewSlide((p: any) => ({ ...p, [f.field]: e.target.value }))} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none" />
                  )}
                </div>
              ))}
              {/* A video screen had no field to hold its link, so the only slides that
                  could be built were static colour cards. */}
              {(editSlide || newSlide).type === "video" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">YouTube link</label>
                  <input
                    value={(editSlide || newSlide).url || ""}
                    onChange={e => editSlide ? setEditSlide((p: any) => ({ ...p, url: e.target.value })) : setNewSlide((p: any) => ({ ...p, url: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none"
                  />
                  {youtubeEmbedUrl((editSlide || newSlide).url) ? (
                    <iframe
                      title="Slide preview"
                      src={youtubeEmbedUrl((editSlide || newSlide).url) as string}
                      className="mt-2 w-full aspect-video rounded-lg border border-border"
                      allow="autoplay; encrypted-media"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Plays muted and on loop on the screen.</p>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Seconds on screen</label>
                <input
                  type="number"
                  min={3}
                  value={(editSlide || newSlide).duration ?? 10}
                  onChange={e => editSlide ? setEditSlide((p: any) => ({ ...p, duration: Number(e.target.value) })) : setNewSlide((p: any) => ({ ...p, duration: Number(e.target.value) }))}
                  className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Background Color</label>
                <div className="flex gap-2 flex-wrap">
                  {BG_PRESETS.map(c => <button key={c} onClick={() => editSlide ? setEditSlide((p: any) => ({ ...p, bg_color: c })) : setNewSlide((p: any) => ({ ...p, bg_color: c }))} className="w-8 h-8 rounded-lg border-2 transition-colors" style={{ background: c, borderColor: (editSlide || newSlide).bg_color === c ? "#fff" : "transparent" }} />)}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAdd(false); setEditSlide(null); }} className="flex-1 py-2 rounded-lg bg-muted hover-elevate text-muted-foreground text-sm transition-colors">Cancel</button>
              <button onClick={editSlide ? handleSaveSlide : handleAddSlide} className="flex-1 py-2 rounded-lg bg-muted hover-elevate text-foreground text-sm font-medium transition-colors">{editSlide ? "Save" : "Add Slide"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
