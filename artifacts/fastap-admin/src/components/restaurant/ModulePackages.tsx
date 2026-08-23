import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, Package } from "lucide-react";
import { modulePackages } from "@/lib/api";

/**
 * Reusable "create your own rate cards / packages" panel. Lets a restaurant define
 * named packages with a price (e.g. a Birthday Party event package, a spa combo, a
 * housekeeping plan). Stored per module in restaurant settings — no new table.
 */
export function ModulePackages({
  restaurantId,
  module,
  title = "Packages & Rates",
  label = "Package",
}: {
  restaurantId?: number | null;
  module: string;
  title?: string;
  label?: string;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", price: "", description: "", duration: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try { setItems(await modulePackages.list(restaurantId, module)); } catch { /* ignore */ }
  }, [restaurantId, module]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!restaurantId || !form.name.trim() || saving) return;
    setSaving(true);
    try {
      await modulePackages.create(restaurantId, module, {
        name: form.name.trim(), price: Number(form.price) || 0,
        description: form.description, duration: form.duration,
      });
      setForm({ name: "", price: "", description: "", duration: "" });
      setOpen(false);
      await load();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!restaurantId) return;
    setItems(prev => prev.filter(p => p.id !== id));
    await modulePackages.remove(restaurantId, module, id).catch(() => {});
  }

  return (
    <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Package className="h-4 w-4 text-amber-400" /><h3 className="text-sm font-bold">{title}</h3></div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold"><Plus className="h-3.5 w-3.5" /> Create {label}</button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-white/30 py-4 text-center">No {label.toLowerCase()}s yet. Create rate cards / packages guests can pick.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map(p => (
            <div key={p.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-white/40 line-clamp-2">{p.description}</p>}
                </div>
                <button onClick={() => remove(p.id)} className="text-white/30 hover:text-red-400 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-amber-400 font-extrabold text-sm">₹{Number(p.price).toLocaleString("en-IN")}</span>
                {p.duration && <span className="text-xs text-white/30">{p.duration}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5"><h2 className="font-bold">Create {label}</h2><button onClick={() => setOpen(false)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button></div>
            <div className="space-y-4">
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{label} Name*</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Birthday Party Package" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white placeholder:text-white/20" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Price ₹</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white placeholder:text-white/20" /></div>
                <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Duration</label><input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 3 hrs" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white placeholder:text-white/20" /></div>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What's included…" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 resize-none text-white placeholder:text-white/20" /></div>
              <div className="flex gap-3"><button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button><button onClick={create} disabled={!form.name.trim() || saving} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">{saving ? "Saving…" : `Create ${label}`}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
