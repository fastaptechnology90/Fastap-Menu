import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { inventory as inventoryApi } from "@/lib/api";
import { Plus, Search, AlertTriangle, TrendingDown, RefreshCw, ShoppingCart, X, Save, Package, Edit2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";

interface InventoryItem {
  id: string | number;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitCost: number;
  costPerUnit?: number;
  supplier?: string;
  lastRestocked?: string;
  category: string;
  expiryDate?: string;
  isLow?: boolean;
}

// Stock is filed under lower-case keys ("grains", "dairy"), so offer those rather than
// prettified names that match nothing in the table.
const CATEGORY_OPTIONS = ["raw_material", "grains", "vegetables", "dairy", "poultry", "meat", "seafood", "spices", "oils", "beverage", "packaging", "cleaning"];

export default function Inventory() {
  const { restaurantId } = useRestaurant();
  const { confirm, confirmDialog } = useConfirm();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!restaurantId) return;
    const data = await inventoryApi.list(restaurantId);
    setItems(Array.isArray(data) ? data.map(i => ({ ...i, id: String(i.id), unitCost: Number(i.costPerUnit) || 0, currentStock: Number(i.currentStock) || 0, minStock: Number(i.minStock) || 0, maxStock: Number(i.maxStock) || 0 })) : []);
  }

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    reload()
      .catch(e => toast({ title: "Could not load stock", description: e?.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [restaurantId]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [filterAlert, setFilterAlert] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ category: "raw_material", unit: "kg" });

  // Derived from the stock on hand, so a filter button can never point at an empty set.
  const categoryNames = ["All", ...Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort()];

  const filtered = items.filter(i => {
    const catMatch = category === "All" || i.category === category;
    const searchMatch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.supplier ?? "").toLowerCase().includes(search.toLowerCase());
    const alertMatch = !filterAlert || i.currentStock < i.minStock;
    return catMatch && searchMatch && alertMatch;
  });

  const lowStockItems = items.filter(i => i.currentStock < i.minStock);
  const expiryAlerts = items.filter(i => i.expiryDate && new Date(i.expiryDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const totalValue = items.reduce((s, i) => s + i.currentStock * i.unitCost, 0);

  function getStockLevel(item: InventoryItem) {
    const pct = (item.currentStock / item.maxStock) * 100;
    if (item.currentStock < item.minStock) return { label: "Low", color: "text-red-400", bg: "bg-red-500", pct };
    if (pct < 50) return { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500", pct };
    return { label: "Good", color: "text-emerald-400", bg: "bg-emerald-500", pct };
  }

  async function handleRestock() {
    if (!restockItem || !restaurantId) return;
    if (!(Number(restockQty) > 0)) {
      toast({ title: "Enter a quantity to add", description: "How much stock came in?", variant: "destructive" });
      return;
    }
    try {
      await inventoryApi.addTransaction(restaurantId, Number(restockItem.id), { type: "in", quantity: Number(restockQty), reason: "restock", performedBy: "Staff" });
      await reload();
      // The modal used to close whether the call succeeded or threw, so a failed delivery
      // looked identical to a booked one and the stock figure quietly stayed wrong.
      toast({ title: `Added ${restockQty} ${restockItem.unit} of ${restockItem.name}` });
      setRestockItem(null);
      setRestockQty("");
    } catch (e: any) {
      toast({ title: "Could not record the restock", description: e?.message, variant: "destructive" });
    }
  }

  async function handleAddItem() {
    if (!restaurantId) return;
    if (!String(newItem.name ?? "").trim()) {
      toast({ title: "Item Name is required", variant: "destructive" });
      return;
    }
    try {
      await inventoryApi.create(restaurantId, { name: newItem.name, category: newItem.category || "raw_material", unit: newItem.unit || "kg", currentStock: newItem.currentStock || 0, minStock: newItem.minStock || 10, maxStock: newItem.maxStock || 50, costPerUnit: newItem.unitCost || 0, supplier: newItem.supplier || "" });
      await reload();
      toast({ title: `${newItem.name} added to stock` });
      setAddMode(false);
      setNewItem({ category: "raw_material", unit: "kg" });
    } catch (e: any) {
      // Keep the form open so nothing typed has to be entered again.
      toast({ title: "Could not add the item", description: e?.message, variant: "destructive" });
    }
  }

  async function handleSaveEdit() {
    if (!editItem || !restaurantId) return;
    if (!String(editItem.name ?? "").trim()) {
      toast({ title: "Item Name cannot be blank", variant: "destructive" });
      return;
    }
    try {
      await inventoryApi.update(restaurantId, Number(editItem.id), {
        name: editItem.name, category: editItem.category, unit: editItem.unit,
        currentStock: Number(editItem.currentStock) || 0,
        minStock: Number(editItem.minStock) || 0,
        maxStock: Number(editItem.maxStock) || 0,
        costPerUnit: Number(editItem.unitCost) || 0,
        supplier: editItem.supplier || "",
      });
      await reload();
      toast({ title: "Item updated" });
      setEditItem(null);
    } catch (e: any) {
      toast({ title: "Could not save the item", description: e?.message, variant: "destructive" });
    }
  }

  async function handleDelete(item: InventoryItem) {
    if (!restaurantId) return;
    const ok = await confirm({
      title: `Remove ${item.name} from stock?`,
      description: "Its stock history goes with it. Recipes that use it will stop drawing it down.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await inventoryApi.delete(restaurantId, Number(item.id));
      await reload();
      toast({ title: `${item.name} removed` });
    } catch (e: any) {
      toast({ title: "Could not remove the item", description: e?.message, variant: "destructive" });
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Inventory Management</h1>
          <p className="text-xs text-white/40">{items.length} items · Total value: ₹{Math.round(totalValue).toLocaleString()}</p>
        </div>
        <button onClick={() => setAddMode(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-red-400 shrink-0" />
          <div>
            <p className="text-2xl font-extrabold text-red-400">{lowStockItems.length}</p>
            <p className="text-xs text-white/50">Low Stock Items</p>
            <p className="text-xs text-red-400/70 mt-0.5">{lowStockItems.map(i => i.name).join(", ")}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/20 p-4 flex items-center gap-3">
          <Package className="h-8 w-8 text-yellow-400 shrink-0" />
          <div>
            <p className="text-2xl font-extrabold text-yellow-400">{expiryAlerts.length}</p>
            <p className="text-xs text-white/50">Expiring Soon (3 days)</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">{expiryAlerts.map(i => i.name).join(", ") || "None"}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-emerald-400 shrink-0" />
          <div>
            <p className="text-2xl font-extrabold text-emerald-400">₹{Math.round(totalValue / 1000)}K</p>
            <p className="text-xs text-white/50">Total Stock Value</p>
            <p className="text-xs text-emerald-400/70 mt-0.5">{items.length} items tracked</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search items, suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categoryNames.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${category === cat ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
              {cat}
            </button>
          ))}
          <button onClick={() => setFilterAlert(!filterAlert)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterAlert ? "bg-red-500/20 border-red-500/40 text-red-300" : "border-white/10 bg-white/5 text-white/50"}`}>
            <AlertTriangle className="h-3 w-3" /> Low Stock Only
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                {["Item", "Category", "Stock Level", "Current / Min / Max", "Unit Cost", "Total Value", "Supplier", "Last Restocked", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-white/40 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(item => {
                const stockLevel = getStockLevel(item);
                const isLow = item.currentStock < item.minStock;
                const isExpiring = item.expiryDate && new Date(item.expiryDate) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                return (
                  <tr key={item.id} className={`hover:bg-white/3 transition-all ${isLow ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {isExpiring && <p className="text-xs text-yellow-400">⚠️ Expires {item.expiryDate}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{item.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full rounded-full ${stockLevel.bg}`} style={{ width: `${Math.min(100, stockLevel.pct)}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${stockLevel.color}`}>{stockLevel.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className={isLow ? "text-red-400 font-bold" : "text-white"}>{item.currentStock}</span>
                      <span className="text-white/30"> / {item.minStock} / {item.maxStock} {item.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-white/60">₹{item.unitCost}/{item.unit}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">₹{Math.round(item.currentStock * item.unitCost).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-white/50 max-w-28 truncate">{item.supplier}</td>
                    <td className="px-4 py-3 text-xs text-white/40">{item.lastRestocked}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setRestockItem(item)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 border border-emerald-500/30 transition-all whitespace-nowrap">
                          <RefreshCw className="h-3 w-3" /> Restock
                        </button>
                        {/* Correcting a wrong unit cost or supplier, and retiring a line
                            entirely, both existed on the server and had no button. */}
                        <button onClick={() => setEditItem({ ...item })} aria-label={`Edit ${item.name}`} className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30 transition-all">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(item)} aria-label={`Remove ${item.name}`} className="h-7 w-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Restock {restockItem.name}</h3>
              <button onClick={() => setRestockItem(null)}><X className="h-5 w-5 text-white/40" /></button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="rounded-xl bg-white/5 p-3 text-xs text-white/60 space-y-1">
                <div>Current: <span className="text-white font-semibold">{restockItem.currentStock} {restockItem.unit}</span></div>
                <div>Minimum: <span className="text-red-400 font-semibold">{restockItem.minStock} {restockItem.unit}</span></div>
                <div>Maximum: <span className="text-white/50">{restockItem.maxStock} {restockItem.unit}</span></div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Quantity to Add ({restockItem.unit})</label>
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/40" placeholder={`e.g. ${restockItem.maxStock - restockItem.currentStock}`} value={restockQty} onChange={e => setRestockQty(e.target.value)} />
              </div>
              {restockQty && <div className="text-xs text-white/50">Estimated cost: <span className="text-amber-400 font-semibold">₹{(Number(restockQty) * restockItem.unitCost).toLocaleString()}</span></div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRestockItem(null)} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Cancel</button>
              <button onClick={handleRestock} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4" /> Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* One form for both adding and correcting a line — the fields are identical. */}
      {(addMode || editItem) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{editItem ? `Edit ${editItem.name}` : "Add Inventory Item"}</h3>
              <button onClick={() => { setAddMode(false); setEditItem(null); }} aria-label="Close"><X className="h-5 w-5 text-white/40" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Item Name", field: "name", type: "text", placeholder: "e.g. Basmati Rice" },
                { label: "Category", field: "category", type: "select", options: Array.from(new Set([...items.map(i => i.category).filter(Boolean), ...CATEGORY_OPTIONS])) },
                { label: "Unit", field: "unit", type: "select", options: ["kg", "g", "L", "ml", "pcs", "dozen", "box"] },
                { label: "Current Stock", field: "currentStock", type: "number" },
                { label: "Minimum Stock", field: "minStock", type: "number" },
                { label: "Maximum Stock", field: "maxStock", type: "number" },
                { label: "Unit Cost (₹)", field: "unitCost", type: "number" },
                { label: "Supplier", field: "supplier", type: "text", placeholder: "Supplier name" },
              ].map(({ label, field, type, placeholder, options }) => {
                const source: any = editItem ?? newItem;
                const set = (value: any) => editItem
                  ? setEditItem({ ...editItem, [field]: value })
                  : setNewItem({ ...newItem, [field]: value });
                return (
                  <div key={field}>
                    <label className="block text-xs text-white/40 mb-1">{label}</label>
                    {type === "select" ? (
                      <select className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white" value={source[field] || ""} onChange={e => set(e.target.value)}>
                        <option value="">Select…</option>
                        {options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={type} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder={placeholder} value={source[field] ?? ""} onChange={e => set(type === "number" ? Number(e.target.value) : e.target.value)} />
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setAddMode(false); setEditItem(null); }} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Cancel</button>
                <button onClick={editItem ? handleSaveEdit : handleAddItem} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" /> {editItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
