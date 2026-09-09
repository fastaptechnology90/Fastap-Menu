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
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">{title}</h3></div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"><Plus className="h-3.5 w-3.5" /> Create {label}</button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No {label.toLowerCase()}s yet. Create rate cards / packages guests can pick.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {items.map(p => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                </div>
                <button onClick={() => remove(p.id)} className="text-muted-foreground hover:text-danger shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-primary font-semibold text-sm">₹{Number(p.price).toLocaleString("en-IN")}</span>
                {p.duration && <span className="text-xs text-muted-foreground">{p.duration}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5"><h2 className="font-semibold">Create {label}</h2><button onClick={() => setOpen(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button></div>
            <div className="space-y-4">
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{label} Name*</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Birthday Party Package" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground placeholder:text-muted-foreground" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Price ₹</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground placeholder:text-muted-foreground" /></div>
                <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Duration</label><input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 3 hrs" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 text-foreground placeholder:text-muted-foreground" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What's included…" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 resize-none text-foreground placeholder:text-muted-foreground" /></div>
              <div className="flex gap-3"><button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button><button onClick={create} disabled={!form.name.trim() || saving} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40">{saving ? "Saving…" : `Create ${label}`}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
