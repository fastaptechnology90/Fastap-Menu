import { useState, useEffect, useCallback } from "react";
import { ChefHat, Plus, X, TrendingUp, Package, Percent, Edit2, Search, Trash2, Lightbulb } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { foodCosting as foodCostingApi, inventory as inventoryApi, menu as menuApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type Ingredient = { name: string; qty: number; unit: string; costPer: string; cost: number; costPerUnit: number; inventoryItemId: number | null };
type Recipe = {
  id: string;
  name: string;
  category: string;
  servings: number;
  sellingPrice: number;
  totalCost: number;
  margin: number;
  ingredients: Ingredient[];
};

type EditIngredient = { name: string; quantity: string; unit: string; costPerUnit: string; inventoryItemId: number | null };

function mapRecipe(r: any): Recipe {
  const ingredients: Ingredient[] = (Array.isArray(r.ingredients) ? r.ingredients : []).map((ing: any) => ({
    name: ing.ingredientName || ing.name,
    qty: parseFloat(String(ing.quantity ?? ing.qty)) || 0,
    unit: ing.unit || "",
    costPer: `₹${ing.costPerUnit ?? 0}/${ing.unit || "unit"}`,
    cost: parseFloat(String(ing.totalCost ?? ing.cost)) || 0,
    costPerUnit: parseFloat(String(ing.costPerUnit ?? 0)) || 0,
    inventoryItemId: ing.inventoryItemId ?? null,
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
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [catFilter, setCatFilter] = useState("all");
  const [newRecipe, setNewRecipe] = useState({ name: "", category: "Main Course", sellingPrice: "" });

  // Ingredient editing modal state
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "", servings: "1", sellingPrice: "" });
  const [editIngredients, setEditIngredients] = useState<EditIngredient[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [stock, setStock] = useState<{ id: number; name: string; unit: string; costPerUnit: number }[]>([]);
  const [dishNames, setDishNames] = useState<string[]>([]);

  // A recipe is tied to a dish by name and an ingredient to a stock line by id. Both lists
  // are loaded so the owner can pick from them rather than retype and hope they match.
  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      inventoryApi.list(restaurantId).catch(() => []),
      menuApi.items(restaurantId).catch(() => []),
    ]).then(([inv, items]) => {
      setStock((Array.isArray(inv) ? inv : []).map((i: any) => ({
        id: i.id, name: i.name, unit: i.unit || "", costPerUnit: Number(i.costPerUnit) || 0,
      })));
      setDishNames((Array.isArray(items) ? items : []).map((i: any) => String(i.name)).filter(Boolean).sort());
    });
  }, [restaurantId]);

  const loadRecipes = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await foodCostingApi.list(restaurantId);
      const mapped = (Array.isArray(data) ? data : []).map(mapRecipe);
      setRecipes(mapped);
      setSelected(prev => prev ? mapped.find(r => r.id === prev.id) ?? mapped[0] ?? null : mapped[0] ?? null);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load recipes", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
    finally { setLoading(false); }
  }, [restaurantId, toast]);

  function openEdit(recipe: Recipe) {
    setEditRecipe(recipe);
    setEditForm({
      name: recipe.name,
      category: recipe.category === "Uncategorized" ? "" : recipe.category,
      servings: String(recipe.servings || 1),
      sellingPrice: String(recipe.sellingPrice || ""),
    });
    setEditIngredients(recipe.ingredients.map(i => ({
      name: i.name || "",
      quantity: String(i.qty || ""),
      unit: i.unit || "",
      costPerUnit: String(i.costPerUnit || ""),
      inventoryItemId: i.inventoryItemId,
    })));
  }

  /** Picking a stock line fills in its name, unit and current cost, and records the link. */
  function linkIngredient(idx: number, stockId: string) {
    const item = stock.find(s => String(s.id) === stockId);
    setEditIngredients(prev => prev.map((ing, i) => i !== idx ? ing : item
      ? { ...ing, inventoryItemId: item.id, name: item.name, unit: item.unit, costPerUnit: String(item.costPerUnit) }
      : { ...ing, inventoryItemId: null }));
  }

  function updateIngredient(idx: number, field: keyof EditIngredient, value: string) {
    setEditIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  }
  function addIngredientRow() {
    setEditIngredients(prev => [...prev, { name: "", quantity: "", unit: "", costPerUnit: "", inventoryItemId: null }]);
  }
  function removeIngredientRow(idx: number) {
    setEditIngredients(prev => prev.filter((_, i) => i !== idx));
  }

  const editTotalCost = editIngredients.reduce((s, ing) => s + (parseFloat(ing.quantity) || 0) * (parseFloat(ing.costPerUnit) || 0), 0);

  async function handleSaveEdit() {
    if (!restaurantId || !editRecipe) return;
    setSavingEdit(true);
    try {
      await foodCostingApi.update(restaurantId, Number(editRecipe.id), {
        name: editForm.name || editRecipe.name,
        category: editForm.category || "Uncategorized",
        servings: parseInt(editForm.servings) || 1,
        sellingPrice: parseFloat(editForm.sellingPrice) || 0,
        ingredients: editIngredients
          .filter(ing => ing.name.trim())
          .map(ing => ({
            name: ing.name.trim(),
            quantity: parseFloat(ing.quantity) || 0,
            unit: ing.unit.trim(),
            costPerUnit: parseFloat(ing.costPerUnit) || 0,
            // Without this the save wiped the stock link and the dish stopped
            // consuming anything the next time it sold.
            inventoryItemId: ing.inventoryItemId,
          })),
      });
      setEditRecipe(null);
      await loadRecipes();
      toast({ title: "Recipe updated", description: "Ingredients and costing were saved." });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to save recipe", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteRecipe(recipe: Recipe) {
    if (!restaurantId) return;
    const ok = window.confirm(`Delete recipe “${recipe.name}”? This cannot be undone.`);
    if (!ok) return;
    try {
      await foodCostingApi.delete(restaurantId, parseInt(recipe.id, 10));
      if (selected?.id === recipe.id) setSelected(null);
      await loadRecipes();
      toast({ title: "Recipe deleted" });
    } catch (e) {
      toast({ title: "Could not delete recipe", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  const categories = ["all", ...Array.from(new Set(recipes.map(r => r.category)))];
  const filtered = recipes.filter(r =>
    (catFilter === "all" || r.category === catFilter) &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()))
  );

  const avgMargin = recipes.length ? Math.round(recipes.reduce((s, r) => s + r.margin, 0) / recipes.length) : 0;

  async function handleCreateRecipe() {
    if (!restaurantId) return;
    if (!newRecipe.name.trim()) {
      toast({ title: "Name the recipe after the dish it costs", description: "The name is what ties it to the menu item.", variant: "destructive" });
      return;
    }
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
      toast({ title: "Recipe created", description: "Open the recipe and use Edit to add ingredients." });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to create recipe", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  if (loading && recipes.length === 0) {
    return <div className="p-6 text-center text-muted-foreground text-sm">Loading recipes…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Food Costing & Recipes</h1>
          <p className="text-xs text-muted-foreground">Ingredient costs, margins & recipe standardization</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus className="h-4 w-4" /> New Recipe
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Recipes Mapped", value: recipes.length, icon: ChefHat, color: "text-primary", bg: "bg-primary/10" },
          { label: "Avg. Gross Margin", value: `${avgMargin}%`, icon: Percent, color: "text-success", bg: "bg-success-subtle" },
          { label: "Highest Margin", value: recipes.length ? `${Math.max(...recipes.map(r => r.margin)).toFixed(1)}%` : "—", icon: TrendingUp, color: "text-muted-foreground", bg: "bg-muted" },
          { label: "Items with Recipes", value: String(recipes.length), icon: Package, color: "text-info", bg: "bg-info-subtle" },
        ].map(s => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div>
              <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recipe List */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes..." className="w-full pl-9 bg-muted border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${catFilter === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover-elevate"}`}>{c}</button>
            ))}
          </div>
          {filtered.map(r => (
            <button key={r.id} onClick={() => setSelected(r)} className={`w-full text-left bg-card border rounded-lg p-4 transition-colors hover:border-border ${selected?.id === r.id ? "border-primary/40" : "border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{r.name}</p>
                <span className={`text-xs font-semibold ${r.margin >= 70 ? "text-success" : r.margin >= 60 ? "text-warning" : "text-danger"}`}>{r.margin.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.category}</p>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-muted-foreground">Cost: <span className="text-foreground font-semibold">₹{r.totalCost}</span></span>
                <span className="text-muted-foreground">Sell: <span className="text-primary font-semibold">₹{r.sellingPrice}</span></span>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${r.margin >= 70 ? "bg-success" : r.margin >= 60 ? "bg-warning" : "bg-danger"}`} style={{ width: `${r.margin}%` }} />
              </div>
            </button>
          ))}
        </div>

        {/* Recipe Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{selected.category} · {selected.servings} serving(s)</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(selected)} title="Edit recipe & ingredients" className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover-elevate"><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  <button onClick={() => handleDeleteRecipe(selected)} title="Delete recipe" className="h-8 w-8 rounded-lg bg-danger-subtle text-danger flex items-center justify-center hover-elevate"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              {/* Cost Summary */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Total Cost", value: `₹${selected.totalCost}`, color: "text-warning", bg: "bg-warning-subtle" },
                  { label: "Selling Price", value: `₹${selected.sellingPrice}`, color: "text-primary", bg: "bg-primary/10" },
                  { label: "Gross Margin", value: `${selected.margin.toFixed(1)}%`, color: "text-success", bg: "bg-success-subtle" },
                ].map(f => (
                  <div key={f.label} className={`${f.bg} rounded-lg p-3 text-center`}>
                    <p className={`text-lg font-semibold ${f.color}`}>{f.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.label}</p>
                  </div>
                ))}
              </div>

              {/* Ingredients Table */}
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ingredients & Costing</h3>
              <div className="rounded-lg border border-border">
                <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {["Ingredient", "Qty", "Cost Rate", "Cost"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selected.ingredients.map(ing => (
                        <tr key={ing.name} className="hover:bg-muted">
                          <td className="px-3 py-2.5 font-medium">{ing.name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{ing.qty}{ing.unit}</td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{ing.costPer}</td>
                          <td className="px-3 py-2.5 font-semibold text-warning">₹{ing.cost}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted font-semibold">
                        <td className="px-3 py-2.5 text-foreground" colSpan={3}>Total Cost per Plate</td>
                        <td className="px-3 py-2.5 text-warning">₹{selected.totalCost}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 p-3 bg-success-subtle border border-success-border rounded-lg">
                <p className="text-xs text-success">
                  <Lightbulb className="h-3.5 w-3.5 inline mb-0.5" /> Profit per plate: <strong>₹{selected.sellingPrice - selected.totalCost}</strong> · 
                  If sold 50 times/day = <strong>₹{((selected.sellingPrice - selected.totalCost) * 50).toLocaleString()}/day</strong> contribution
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <ChefHat className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a recipe to view costing breakdown</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold">Add Recipe</h2><button onClick={() => setShowAdd(false)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4">
              {/* The recipe reaches the menu — margin, and the stock a sale draws down —
                  only when its name matches a dish exactly. Typing it by hand meant one
                  stray word left the recipe costing nothing that anyone sells, so offer
                  the menu itself. */}
              <div>
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Dish Name</label>
                <input
                  list="menu-dish-names"
                  value={newRecipe.name}
                  onChange={e => setNewRecipe(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  placeholder="Start typing a dish from your menu"
                />
                <datalist id="menu-dish-names">
                  {dishNames.map(n => <option key={n} value={n} />)}
                </datalist>
                {newRecipe.name.trim() && !dishNames.some(n => n.toLowerCase() === newRecipe.name.trim().toLowerCase()) && (
                  <p className="text-2xs text-warning mt-1">
                    No menu item is called this. The recipe will still save, but it will not show a margin on the menu or move stock when the dish sells.
                  </p>
                )}
              </div>
              <div><label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Category</label><input value={newRecipe.category} onChange={e => setNewRecipe(p => ({ ...p, category: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" placeholder="Main Course, Starter, Dessert..." /></div>
              <div><label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Selling Price (₹)</label><input value={newRecipe.sellingPrice} onChange={e => setNewRecipe(p => ({ ...p, sellingPrice: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" placeholder="e.g. 320" /></div>
              <p className="text-xs text-muted-foreground">You can add ingredients after creating the recipe.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-semibold">Cancel</button>
                <button onClick={handleCreateRecipe} disabled={!newRecipe.name} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40">Create Recipe</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recipe & Ingredients Modal */}
      {editRecipe && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Edit Recipe & Ingredients</h2>
              <button onClick={() => setEditRecipe(null)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Dish Name</label>
                  <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" placeholder="Dish name" /></div>
                <div><label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Category</label>
                  <input value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" placeholder="Main Course..." /></div>
                <div><label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Servings</label>
                  <input type="number" min={1} value={editForm.servings} onChange={e => setEditForm(p => ({ ...p, servings: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" placeholder="1" /></div>
                <div><label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5 block">Selling Price (₹)</label>
                  <input type="number" min={0} value={editForm.sellingPrice} onChange={e => setEditForm(p => ({ ...p, sellingPrice: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" placeholder="320" /></div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Ingredients</label>
                  <button onClick={addIngredientRow} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary"><Plus className="h-3.5 w-3.5" /> Add ingredient</button>
                </div>
                {editIngredients.length === 0 && (
                  <p className="text-xs text-muted-foreground py-3 text-center">No ingredients yet. Click "Add ingredient" to start building the recipe cost.</p>
                )}
                <div className="min-w-0 max-w-full space-y-2 overflow-x-auto overscroll-x-contain">
                  {editIngredients.map((ing, idx) => {
                    const rowCost = (parseFloat(ing.quantity) || 0) * (parseFloat(ing.costPerUnit) || 0);
                    return (
                      <div key={idx} className="grid min-w-[560px] grid-cols-12 gap-2 items-center">
                        {/* Selecting a stock line is what makes selling this dish draw the
                            ingredient down. Free text costs the plate but moves no stock. */}
                        <select
                          value={ing.inventoryItemId == null ? "" : String(ing.inventoryItemId)}
                          onChange={e => linkIngredient(idx, e.target.value)}
                          aria-label="Stock item"
                          className={`col-span-4 bg-muted border rounded-lg px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 ${ing.inventoryItemId == null ? "border-warning-border" : "border-border"}`}
                        >
                          <option value="">{ing.name || "Not linked to stock"}</option>
                          {stock.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                        </select>
                        <input type="number" min={0} value={ing.quantity} onChange={e => updateIngredient(idx, "quantity", e.target.value)} placeholder="Qty" className="col-span-2 bg-muted border border-border rounded-lg px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
                        <input value={ing.unit} onChange={e => updateIngredient(idx, "unit", e.target.value)} placeholder="Unit" className="col-span-2 bg-muted border border-border rounded-lg px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
                        <input type="number" min={0} value={ing.costPerUnit} onChange={e => updateIngredient(idx, "costPerUnit", e.target.value)} placeholder="₹/unit" className="col-span-2 bg-muted border border-border rounded-lg px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
                        <div className="col-span-1 text-right text-xs font-semibold text-warning">₹{rowCost.toFixed(0)}</div>
                        <button onClick={() => removeIngredientRow(idx)} className="col-span-1 flex items-center justify-center text-danger hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
                <span className="text-xs text-muted-foreground">Total Cost per Plate (auto-calculated)</span>
                <span className="text-sm font-semibold text-warning">₹{editTotalCost.toFixed(2)}</span>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditRecipe(null)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-semibold">Cancel</button>
                <button onClick={handleSaveEdit} disabled={savingEdit || !editForm.name.trim()} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40">{savingEdit ? "Saving…" : "Save Recipe"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
