import { useState, useEffect, useCallback } from "react";
import { ChefHat, Plus, X, TrendingUp, Package, Percent, Edit2, Search } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { foodCosting as foodCostingApi } from "@/lib/api";

type Recipe = {
  id: string;
  name: string;
  category: string;
  servings: number;
  sellingPrice: number;
  totalCost: number;
  margin: number;
  ingredients: { name: string; qty: number; unit: string; costPer: string; cost: number }[];
};

function mapRecipe(r: any): Recipe {
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).map((ing: any) => ({
    name: ing.ingredientName || ing.name,
    qty: parseFloat(String(ing.quantity ?? ing.qty)) || 0,
    unit: ing.unit || "",
    costPer: `₹${ing.costPerUnit ?? 0}/${ing.unit || "unit"}`,
    cost: parseFloat(String(ing.totalCost ?? ing.cost)) || 0,
  }));
  return {
    id: String(r.id),
    name: r.name,
    category: r.category || "Uncategorized",
    servings: r.servings ?? 1,
    sellingPrice: parseFloat(String(r.sellingPrice)) || 0,
    totalCost: parseFloat(String(r.totalCost)) || 0,
    margin: parseFloat(String(r.profitMargin ?? r.margin)) || 0,
    ingredients,
  };
}

export default function FoodCosting() {
  const { restaurantId } = useRestaurant();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [catFilter, setCatFilter] = useState("all");
  const [newRecipe, setNewRecipe] = useState({ name: "", category: "Main Course", sellingPrice: "" });

  const loadRecipes = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await foodCostingApi.list(restaurantId);
      const mapped = (Array.isArray(data) ? data : []).map(mapRecipe);
      setRecipes(mapped);
      setSelected(prev => prev ? mapped.find(r => r.id === prev.id) ?? mapped[0] ?? null : mapped[0] ?? null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  const categories = ["all", ...Array.from(new Set(recipes.map(r => r.category)))];
  const filtered = recipes.filter(r =>
    (catFilter === "all" || r.category === catFilter) &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()))
  );

  const avgMargin = recipes.length ? Math.round(recipes.reduce((s, r) => s + r.margin, 0) / recipes.length) : 0;

  async function handleCreateRecipe() {
    if (!newRecipe.name || !restaurantId) return;
    try {
      await foodCostingApi.create(restaurantId, {
        name: newRecipe.name,
        category: newRecipe.category,
        servings: 1,
        sellingPrice: parseFloat(newRecipe.sellingPrice) || 0,
        ingredients: [],
      });
      setNewRecipe({ name: "", category: "Main Course", sellingPrice: "" });
      setShowAdd(false);
      await loadRecipes();
    } catch (e) { console.error(e); }
  }

  if (loading && recipes.length === 0) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading recipes…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Food Costing & Recipes</h1>
          <p className="text-xs text-white/40">Ingredient costs, margins & recipe standardization</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
          <Plus className="h-4 w-4" /> New Recipe
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Recipes Mapped", value: recipes.length, icon: ChefHat, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Avg. Gross Margin", value: `${avgMargin}%`, icon: Percent, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Highest Margin", value: recipes.length ? `${Math.max(...recipes.map(r => r.margin)).toFixed(1)}%` : "—", icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Items with Recipes", value: String(recipes.length), icon: Package, color: "text-blue-400", bg: "bg-blue-500/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div>
              <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-white/40">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recipe List */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes..." className="w-full pl-9 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${catFilter === c ? "bg-amber-500 text-black" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>{c}</button>
            ))}
          </div>
          {filtered.map(r => (
            <button key={r.id} onClick={() => setSelected(r)} className={`w-full text-left bg-[#0e1520] border rounded-2xl p-4 transition-all hover:border-white/15 ${selected?.id === r.id ? "border-amber-500/40" : "border-white/5"}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold">{r.name}</p>
                <span className={`text-xs font-extrabold ${r.margin >= 70 ? "text-emerald-400" : r.margin >= 60 ? "text-yellow-400" : "text-red-400"}`}>{r.margin.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-white/40">{r.category}</p>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-white/40">Cost: <span className="text-white font-semibold">₹{r.totalCost}</span></span>
                <span className="text-white/40">Sell: <span className="text-amber-400 font-semibold">₹{r.sellingPrice}</span></span>
              </div>
              <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${r.margin >= 70 ? "bg-emerald-500" : r.margin >= 60 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${r.margin}%` }} />
              </div>
            </button>
          ))}
        </div>

        {/* Recipe Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold">{selected.name}</h2>
                  <p className="text-xs text-white/40 mt-0.5">{selected.category} · {selected.servings} serving(s)</p>
                </div>
                <button className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15"><Edit2 className="h-3.5 w-3.5 text-white/60" /></button>
              </div>

              {/* Cost Summary */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Total Cost", value: `₹${selected.totalCost}`, color: "text-orange-400", bg: "bg-orange-500/10" },
                  { label: "Selling Price", value: `₹${selected.sellingPrice}`, color: "text-amber-400", bg: "bg-amber-500/10" },
                  { label: "Gross Margin", value: `${selected.margin.toFixed(1)}%`, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                ].map(f => (
                  <div key={f.label} className={`${f.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-lg font-extrabold ${f.color}`}>{f.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{f.label}</p>
                  </div>
                ))}
              </div>

              {/* Ingredients Table */}
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wide mb-3">Ingredients & Costing</h3>
              <div className="rounded-xl overflow-hidden border border-white/5">
                <table className="w-full text-sm">
                  <thead className="bg-white/3">
                    <tr>
                      {["Ingredient", "Qty", "Cost Rate", "Cost"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-white/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selected.ingredients.map(ing => (
                      <tr key={ing.name} className="hover:bg-white/3">
                        <td className="px-3 py-2.5 font-medium">{ing.name}</td>
                        <td className="px-3 py-2.5 text-white/60">{ing.qty}{ing.unit}</td>
                        <td className="px-3 py-2.5 text-white/40 text-xs">{ing.costPer}</td>
                        <td className="px-3 py-2.5 font-bold text-orange-400">₹{ing.cost}</td>
                      </tr>
                    ))}
                    <tr className="bg-white/3 font-bold">
                      <td className="px-3 py-2.5 text-white" colSpan={3}>Total Cost per Plate</td>
                      <td className="px-3 py-2.5 text-orange-400">₹{selected.totalCost}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-3 bg-emerald-500/8 border border-emerald-500/15 rounded-xl">
                <p className="text-xs text-emerald-400">
                  💡 Profit per plate: <strong>₹{selected.sellingPrice - selected.totalCost}</strong> · 
                  If sold 50 times/day = <strong>₹{((selected.sellingPrice - selected.totalCost) * 50).toLocaleString()}/day</strong> contribution
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-8 text-center">
              <ChefHat className="h-8 w-8 text-amber-400/40 mx-auto mb-2" />
              <p className="text-sm text-white/30">Select a recipe to view costing breakdown</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5"><h2 className="text-base font-bold">Add Recipe</h2><button onClick={() => setShowAdd(false)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4">
              <div><label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">Dish Name</label><input value={newRecipe.name} onChange={e => setNewRecipe(p => ({ ...p, name: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" placeholder="e.g. Paneer Tikka" /></div>
              <div><label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">Category</label><input value={newRecipe.category} onChange={e => setNewRecipe(p => ({ ...p, category: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" placeholder="Main Course, Starter, Dessert..." /></div>
              <div><label className="text-xs text-white/50 font-semibold uppercase tracking-wide mb-1.5 block">Selling Price (₹)</label><input value={newRecipe.sellingPrice} onChange={e => setNewRecipe(p => ({ ...p, sellingPrice: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" placeholder="e.g. 320" /></div>
              <p className="text-xs text-white/40">You can add ingredients after creating the recipe.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm font-semibold">Cancel</button>
                <button onClick={handleCreateRecipe} disabled={!newRecipe.name} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm disabled:opacity-40">Create Recipe</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
