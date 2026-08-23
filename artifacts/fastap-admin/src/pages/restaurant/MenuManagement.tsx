import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { menu as menuApi } from "@/lib/api";
import { PermissionGate } from "@/components/restaurant/PermissionGate";
type MenuItem = any;
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Star, Clock, Flame, X, Save, Filter } from "lucide-react";

const CATEGORIES = ["All", "Starters", "Main Course", "Desserts", "Beverages", "Breads", "Special"];

// Backend stores diet as a `dietaryTags` array (not an `isVeg` flag) and category as a
// `categoryId` FK (not a name) — map both ways so add/edit actually persist.
function dietaryFromTags(tags: any): "veg" | "non-veg" {
  const arr = (Array.isArray(tags) ? tags : []).map((t: any) => String(t).toLowerCase());
  return arr.some(t => /non|egg|chicken|mutton|meat|fish|prawn/.test(t)) ? "non-veg" : "veg";
}
function mapItem(i: any, nameOf: (id: any) => string): any {
  return {
    ...i, id: String(i.id),
    category: nameOf(i.categoryId),
    subcategory: i.subcategory || "",
    price: parseFloat(i.price) || 0,
    cost: parseFloat(i.cost) || 0,
    dietary: dietaryFromTags(i.dietaryTags),
    available: i.isAvailable ?? true,
    featured: i.isFeatured ?? false,
    spiceLevel: i.spiceLevel || 0,
    prepTime: i.prepTime || 15,
    calories: i.calories || 0,
    description: i.description || "",
    ingredients: [], allergens: [],
  };
}

export default function MenuManagement() {
  const { restaurantId } = useRestaurant();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!restaurantId) return;
    const [data, cats] = await Promise.all([
      menuApi.items(restaurantId).catch(() => []),
      menuApi.categories(restaurantId).catch(() => []),
    ]);
    const catList = Array.isArray(cats) ? cats : [];
    setCategories(catList.map((c: any) => ({ id: c.id, name: c.name })));
    const nameOf = (id: any) => catList.find((c: any) => c.id === id)?.name || "Uncategorized";
    setItems(Array.isArray(data) ? data.map((i: any) => mapItem(i, nameOf)) : []);
  }

  // Resolve a category name → its id, creating the category if it doesn't exist yet.
  async function resolveCategoryId(name: string): Promise<number | undefined> {
    if (!name || !restaurantId) return undefined;
    const found = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (found) return found.id;
    try {
      const c = await menuApi.createCategory(restaurantId, { name });
      setCategories(prev => [...prev, { id: c.id, name: c.name }]);
      return c.id;
    } catch { return undefined; }
  }

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [restaurantId]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [filterAvail, setFilterAvail] = useState<"all" | "available" | "unavailable">("all");
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({ dietary: "veg", available: true, featured: false, spiceLevel: 1 });

  const filtered = items.filter(i => {
    const catMatch = category === "All" || i.category === category;
    const searchMatch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const availMatch = filterAvail === "all" || (filterAvail === "available" ? i.available : !i.available);
    return catMatch && searchMatch && availMatch;
  });

  async function handleToggle(id: string) {
    const item = items.find(i => i.id === id);
    if (!item || !restaurantId) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i));
    await menuApi.updateItem(restaurantId, parseInt(id), { isAvailable: !item.available }).catch(() => {});
  }

  async function handleSaveEdit() {
    if (!editItem || !restaurantId) return;
    const categoryId = await resolveCategoryId(editItem.category);
    await menuApi.updateItem(restaurantId, parseInt(editItem.id), {
      name: editItem.name, price: String(editItem.price), description: editItem.description,
      categoryId, dietaryTags: [editItem.dietary || "veg"],
      spiceLevel: editItem.spiceLevel ?? 0, prepTime: editItem.prepTime ?? 15,
      calories: editItem.calories ?? 0, isFeatured: editItem.featured ?? false,
      isAvailable: editItem.available,
    }).catch(() => {});
    setItems(prev => prev.map(i => i.id === editItem.id ? editItem : i));
    setEditItem(null);
  }

  async function handleAddItem() {
    if (!newItem.name || !newItem.price || !restaurantId) return;
    const categoryId = await resolveCategoryId(newItem.category || "Main Course");
    await menuApi.createItem(restaurantId, {
      name: newItem.name, price: String(newItem.price), description: newItem.description || "",
      categoryId, dietaryTags: [newItem.dietary || "veg"],
      spiceLevel: newItem.spiceLevel ?? 0, prepTime: newItem.prepTime ?? 15,
      calories: newItem.calories ?? 0, isFeatured: newItem.featured ?? false,
      isAvailable: newItem.available ?? true,
    }).catch(() => {});
    await reload();
    setAddMode(false);
    setNewItem({ dietary: "veg", available: true, featured: false, spiceLevel: 1 });
  }

  async function handleDelete(id: string) {
    if (!restaurantId) return;
    if (!confirm("Delete this menu item?")) return;
    setItems(prev => prev.filter(i => i.id !== id));
    await menuApi.deleteItem(restaurantId, parseInt(id)).catch(() => {});
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Menu Management</h1>
          <p className="text-xs text-white/40">{items.filter(i => i.available).length} available · {items.filter(i => !i.available).length} hidden</p>
        </div>
        <button onClick={() => setAddMode(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30"
            placeholder="Search menu items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${category === cat ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
              {cat}
            </button>
          ))}
          <div className="h-px w-px shrink-0" />
          {(["all", "available", "unavailable"] as const).map(f => (
            <button key={f} onClick={() => setFilterAvail(f)} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${filterAvail === f ? "bg-white/20 border-white/30 text-white" : "border-white/10 bg-white/5 text-white/30"}`}>
              {f === "all" ? "All Status" : f === "available" ? "✓ Available" : "✗ Hidden"}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Table */}
      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                {["Item", "Category", "Price", "Cost", "Margin", "Type", "Spice", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-white/40 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(item => {
                const margin = item.cost > 0 ? Math.round(((item.price - item.cost) / item.price) * 100) : null;
                return (
                  <tr key={item.id} className={`hover:bg-white/3 transition-all ${!item.available ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-base ${item.dietary === "veg" ? "bg-green-500/10" : item.dietary === "vegan" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                          {item.category === "Starters" ? "🍢" : item.category === "Main Course" ? "🍛" : item.category === "Desserts" ? "🍮" : item.category === "Beverages" ? "🥤" : "🍽️"}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{item.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.featured && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                            <span className="text-xs text-white/30 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{item.prepTime}m</span>
                            {item.calories > 0 && <span className="text-xs text-white/30">{item.calories}cal</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{item.category}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">₹{item.price}</td>
                    <td className="px-4 py-3 text-white/50">₹{item.cost}</td>
                    <td className="px-4 py-3">
                      {margin !== null && (
                        <span className={`text-xs font-semibold ${margin >= 60 ? "text-emerald-400" : margin >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                          {margin}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${item.dietary === "veg" ? "bg-green-500/20 text-green-400" : item.dietary === "vegan" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${item.dietary === "veg" || item.dietary === "vegan" ? "bg-green-400" : "bg-red-400"}`} />
                        {item.dietary}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(l => (
                          <div key={l} className={`h-2 w-3 rounded-sm ${l <= item.spiceLevel ? "bg-red-500" : "bg-white/10"}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PermissionGate permission="hide_menu">
                      <button onClick={() => handleToggle(item.id)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${item.available ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-white/10 text-white/40 hover:bg-white/15"}`}>
                        {item.available ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {item.available ? "Visible" : "Hidden"}
                      </button>
                      </PermissionGate>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <PermissionGate permission="edit_pricing">
                        <button onClick={() => setEditItem({ ...item })} className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30 transition-all">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        </PermissionGate>
                        <PermissionGate permission="add_menu">
                        <button onClick={() => handleDelete(item.id)} className="h-7 w-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30 transition-all">
                          <Trash2 className="h-3 w-3" />
                        </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {(editItem || addMode) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#111827] rounded-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-bold">{addMode ? "Add New Item" : "Edit Item"}</h3>
              <button onClick={() => { setEditItem(null); setAddMode(false); }}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { label: "Item Name", field: "name", type: "text", placeholder: "e.g. Paneer Tikka" },
                { label: "Description", field: "description", type: "textarea", placeholder: "Brief description..." },
                { label: "Category", field: "category", type: "select", options: ["Starters", "Main Course", "Desserts", "Beverages", "Breads"] },
                { label: "Dietary Type", field: "dietary", type: "select", options: ["veg", "non-veg", "vegan"] },
                { label: "Price (₹)", field: "price", type: "number", placeholder: "e.g. 320" },
                { label: "Cost Price (₹)", field: "cost", type: "number", placeholder: "e.g. 85" },
                { label: "Prep Time (min)", field: "prepTime", type: "number", placeholder: "e.g. 15" },
                { label: "Calories", field: "calories", type: "number", placeholder: "e.g. 280" },
              ].map(({ label, field, type, placeholder, options }) => (
                <div key={field}>
                  <label className="block text-xs text-white/40 mb-1.5">{label}</label>
                  {type === "textarea" ? (
                    <textarea
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 resize-none placeholder:text-white/30"
                      rows={2}
                      placeholder={placeholder}
                      value={(editItem || newItem)[field as keyof MenuItem] as string || ""}
                      onChange={e => editItem ? setEditItem({ ...editItem, [field]: e.target.value }) : setNewItem({ ...newItem, [field]: e.target.value })}
                    />
                  ) : type === "select" ? (
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white"
                      value={(editItem || newItem)[field as keyof MenuItem] as string || ""}
                      onChange={e => editItem ? setEditItem({ ...editItem, [field]: e.target.value }) : setNewItem({ ...newItem, [field]: e.target.value })}
                    >
                      {options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={type}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30"
                      placeholder={placeholder}
                      value={(editItem || newItem)[field as keyof MenuItem] as string | number || ""}
                      onChange={e => editItem ? setEditItem({ ...editItem, [field]: type === "number" ? Number(e.target.value) : e.target.value }) : setNewItem({ ...newItem, [field]: type === "number" ? Number(e.target.value) : e.target.value })}
                    />
                  )}
                </div>
              ))}

              {/* Spice Level */}
              <div>
                <label className="block text-xs text-white/40 mb-2">Spice Level</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(l => (
                    <button key={l} onClick={() => editItem ? setEditItem({ ...editItem, spiceLevel: l }) : setNewItem({ ...newItem, spiceLevel: l })} className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${(editItem?.spiceLevel || newItem.spiceLevel || 0) === l ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/40"}`}>
                      {l === 0 ? "None" : l === 1 ? "Mild" : l === 2 ? "Medium" : "Hot"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editItem?.featured || newItem.featured || false} onChange={e => editItem ? setEditItem({ ...editItem, featured: e.target.checked }) : setNewItem({ ...newItem, featured: e.target.checked })} />
                  <span className="text-white/60">Mark as Featured</span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setEditItem(null); setAddMode(false); }} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 font-semibold text-sm">
                  Cancel
                </button>
                <PermissionGate permission={addMode ? "add_menu" : "edit_pricing"}>
                <button onClick={editItem ? handleSaveEdit : handleAddItem} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" /> {addMode ? "Add Item" : "Save Changes"}
                </button>
                </PermissionGate>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
