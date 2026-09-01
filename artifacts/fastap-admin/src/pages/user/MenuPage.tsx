import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser, type DietaryFilter } from "@/contexts/UserContext";
import { useLocaleAccessibility } from "@/contexts/LocaleAccessibilityContext";
import { useOffline } from "@/contexts/OfflineContext";
import { usePwa } from "@/contexts/PwaContext";
import { publicApi } from "@/lib/api";
import { DEFAULT_CUSTOMIZATION } from "@/lib/digitalMenuCatalog";
import { TABLE_INTERACTION_REQUESTS } from "@/lib/smartDiningCatalog";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestEmpty } from "@/components/user/GuestApiState";
import { resolveGuestSlug, DEMO_SLUG } from "@/lib/guestDemo";
import { loadActiveOrder, clearActiveOrder } from "@/lib/activeOrder";
import { MenuGridCard } from "@/components/user/MenuGridCard";
import { ServiceHubSheet } from "@/components/user/ServiceHubSheet";
import { MenuFilterSheet } from "@/components/user/MenuFilterSheet";
import { AppImage } from "@/components/shared/AppImage";
import { Preview360Viewer } from "@/components/user/Preview360Viewer";
import { Icon } from "@/components/shared/Icon";
import {
  Search, ShoppingCart, Bell, Star, Info,
  Plus, Minus, X,
  SlidersHorizontal, Camera, Phone, RotateCw, Play, Image as ImageIcon, Grid3x3,
} from "lucide-react";

type CategoryGroup = "all" | "food" | "beverage" | "special";

const CATEGORY_ICONS: Record<string, string> = {
  breakfast: "🌅", lunch: "🍱", dinner: "🌙", snacks: "🥨", starters: "🥗",
  "main-course": "🍛", desserts: "🍰", "kids-menu": "👶", "healthy-menu": "🥗", "diet-menu": "⚖️",
  "soft-drinks": "🥤", coffee: "☕", tea: "🍵", mocktails: "🍹", cocktails: "🍸",
  "premium-liquor": "🥃", "wine-menu": "🍷", "beer-menu": "🍺",
  "festival-menu": "🎉", "seasonal-menu": "🍂", "chef-special": "👨‍🍳", "happy-hour-menu": "⏰",
  "midnight-menu": "🌃", "poolside-menu": "🏊", "spa-wellness-menu": "💆", "banquet-menu": "🎊",
};

interface CustomizationOpts {
  extraCheese?: { label: string; price: number };
  extraSpicy?: { label: string; price: number };
  removeIngredients?: string[];
  portionSizes?: { name: string; price: number }[];
  toppings?: { name: string; price: number }[];
  comboUpgrades?: { name: string; price: number }[];
}

interface MenuDisplayItem {
  id: string;
  name: string;
  category: string;
  categoryGroup: string;
  price: number;
  dietaryTags: string[];
  rating: number;
  reviews: number;
  cookTime: string;
  calories: number;
  protein: number;
  carbs: number;
  spice: number;
  badges: string[];
  desc: string;
  ingredients: string[];
  allergens: string[];
  prepMethod?: string;
  chefRecommended: boolean;
  imageUrl?: string;
  videoUrl?: string;
  preview360Url?: string;
  addons: { name: string; price: number }[];
  customizations: string[];
  customizationOptions: CustomizationOpts;
}

function matchesDietaryFilter(tags: string[], filter: DietaryFilter): boolean {
  if (filter === "all") return true;
  const lower = tags.map(t => t.toLowerCase());
  const has = (...keys: string[]) => keys.some(k => lower.some(t => t.includes(k)));
  switch (filter) {
    case "veg": return has("vegetarian", "vegan", "jain") && !has("non-veg", "non_veg");
    case "non-veg": return has("non-veg", "non_veg") || (!has("vegetarian", "vegan", "jain") && lower.length === 0);
    case "jain": return has("jain");
    case "vegan": return has("vegan");
    case "gluten-free": return has("gluten-free", "gluten free");
    case "sugar-free": return has("sugar-free", "sugar free");
    case "keto": return has("keto");
    case "organic": return has("organic");
    case "nut-free": return has("nut-free", "nut free") || !lower.some(t => t.includes("nut"));
    case "dairy-free": return has("dairy-free", "dairy free", "vegan");
    default: return true;
  }
}

function parseCustomization(raw: unknown): CustomizationOpts {
  const base = DEFAULT_CUSTOMIZATION as CustomizationOpts;
  if (typeof raw !== "object" || raw === null) return base;
  return { ...base, ...(raw as CustomizationOpts) };
}

function mapApiItem(i: Record<string, unknown>, categorySlug: string, categoryGroup = "food", restaurantRating = 0): MenuDisplayItem {
  const tags = Array.isArray(i.dietaryTags) ? i.dietaryTags as string[] : [];
  const badges: string[] = [];
  if (i.chefRecommended) badges.push("chef-recommended");
  if (i.isFeatured) badges.push("chef-special");
  if ((i.orderCount as number || 0) > 30) badges.push("bestseller");
  if ((i.viewCount as number || 0) > 100) badges.push("trending");
  const addons = Array.isArray(i.addons)
    ? (i.addons as Record<string, unknown>[]).map(a => ({ name: String(a.name ?? a), price: parseFloat(String(a.price ?? 0)) }))
    : [];
  const customizations = Array.isArray(i.variants)
    ? (i.variants as unknown[]).map(v => (typeof v === "object" && v !== null ? String((v as Record<string, unknown>).name ?? v) : String(v)))
    : [];
  const custOpts = parseCustomization(i.customizationOptions);
  return {
    id: String(i.id),
    name: String(i.name),
    category: categorySlug,
    categoryGroup,
    price: (i.discountedPrice as number) ?? parseFloat(String(i.price ?? 0)),
    dietaryTags: tags,
    rating: restaurantRating > 0 ? restaurantRating : 0,
    reviews: (i.orderCount as number) || 0,
    cookTime: i.prepTime ? `${i.prepTime} min` : "15 min",
    calories: (i.calories as number) || 0,
    protein: (i.protein as number) || 0,
    carbs: (i.carbs as number) || 0,
    spice: (i.spiceLevel as number) ?? 0,
    badges,
    desc: String(i.description || ""),
    ingredients: i.ingredients ? String(i.ingredients).split(",").map(s => s.trim()).filter(Boolean) : [],
    allergens: i.allergens && i.allergens !== "none" ? String(i.allergens).split(",").map(s => s.trim()).filter(Boolean) : [],
    prepMethod: i.prepMethod ? String(i.prepMethod) : undefined,
    chefRecommended: Boolean(i.chefRecommended),
    imageUrl: i.imageUrl ? String(i.imageUrl) : undefined,
    videoUrl: i.videoUrl ? String(i.videoUrl) : undefined,
    preview360Url: i.preview360Url ? String(i.preview360Url) : undefined,
    addons,
    customizations,
    customizationOptions: custOpts,
  };
}

function categoryIcon(name: string, slug?: string): string {
  const key = (slug || name).toLowerCase().replace(/\s+/g, "-");
  for (const [k, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return icon;
  }
  if (/dessert|sweet/i.test(name)) return "🍰";
  if (/drink|beverage|coffee|bar/i.test(name)) return "☕";
  if (/starter|appet/i.test(name)) return "🥗";
  return "🍽️";
}

interface ItemDetailProps {
  item: MenuDisplayItem;
  onClose: () => void;
  onAdd: (customizations: string[], addons: MenuDisplayItem["addons"], instructions?: string, unitPrice?: number) => void;
  readOnly?: boolean;
}

function ItemDetail({ item, onClose, onAdd, readOnly }: ItemDetailProps) {
  const [qty, setQty] = useState(1);
  const [selectedCustom, setSelectedCustom] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{ name: string; price: number }[]>([]);
  const [instructions, setInstructions] = useState("");
  const [mediaTab, setMediaTab] = useState<"photo" | "video" | "360">("photo");
  const [portion, setPortion] = useState<string>("");
  const [extraCheese, setExtraCheese] = useState(false);
  const [extraSpicy, setExtraSpicy] = useState(false);
  const opts = item.customizationOptions;

  const portionSizes = opts.portionSizes?.length
    ? opts.portionSizes
    : item.customizations.map(name => ({ name, price: name.toLowerCase().includes("large") ? 25 : 0 }));

  const removeOptions = opts.removeIngredients ?? ["No onion", "No garlic", "No dairy", "No nuts"];
  const toppings = opts.toppings ?? [];
  const comboUpgrades = opts.comboUpgrades ?? [];

  function toggleCustom(c: string) {
    setSelectedCustom(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  }
  function toggleAddon(a: { name: string; price: number }) {
    setSelectedAddons(p => p.find(x => x.name === a.name) ? p.filter(x => x.name !== a.name) : [...p, a]);
  }

  const portionPrice = portionSizes.find(p => p.name === portion)?.price ?? 0;
  const extrasPrice = (extraCheese ? (opts.extraCheese?.price ?? 15) : 0) + (extraSpicy ? (opts.extraSpicy?.price ?? 0) : 0);
  const unitPrice = item.price + portionPrice + extrasPrice + selectedAddons.reduce((s, a) => s + a.price, 0);
  const total = unitPrice * qty;

  const allCustomizations = [
    ...selectedCustom,
    ...(portion ? [`Portion: ${portion}`] : []),
    ...(extraCheese ? [opts.extraCheese?.label ?? "Extra Cheese"] : []),
    ...(extraSpicy ? [opts.extraSpicy?.label ?? "Extra Spicy"] : []),
  ];

  const hasVideo = Boolean(item.videoUrl);
  const has360 = Boolean(item.preview360Url);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-guest-elevated rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="relative h-52 bg-gradient-to-br from-orange-900/30 to-slate-900">
          {mediaTab === "photo" ? (
            <AppImage src={item.imageUrl} alt={item.name} fallbackId={item.id} category={item.category} className="h-full w-full" iconFallback="restaurant_menu" />
          ) : mediaTab === "video" && item.videoUrl ? (
            <video src={item.videoUrl} controls autoPlay muted className="w-full h-full object-cover" />
          ) : mediaTab === "360" && item.preview360Url ? (
            <Preview360Viewer src={item.preview360Url} alt={`${item.name} 360`} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Camera className="h-16 w-16 text-white/10" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1">
            {[
              { id: "photo" as const, label: "HD", icon: ImageIcon, show: Boolean(item.imageUrl) },
              { id: "video" as const, label: "Video", icon: Play, show: hasVideo },
              { id: "360" as const, label: "360°", icon: RotateCw, show: has360 },
            ].filter(t => t.show).map(tab => (
              <button
                key={tab.id}
                onClick={() => setMediaTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${mediaTab === tab.id ? "bg-orange-500 text-white" : "bg-black/50 text-white/70"}`}
              >
                <tab.icon className="h-3 w-3" />{tab.label}
              </button>
            ))}
          </div>
          <div className="absolute top-3 right-3">
            <button onClick={onClose} className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
            {item.badges.map(b => (
              <span key={b} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b === "bestseller" ? "bg-orange-500 text-white" : b === "trending" ? "bg-pink-500 text-white" : b === "chef-recommended" ? "bg-amber-500 text-white" : b === "chef-special" ? "bg-violet-500 text-white" : "bg-emerald-500 text-white"}`}>
                {b === "bestseller" ? "🏆 Bestseller" : b === "trending" ? "🔥 Trending" : b === "chef-recommended" ? "⭐ Chef Recommended" : b === "chef-special" ? "👨‍🍳 Chef Special" : "✨ New"}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-bold">{item.name}</h3>
              {item.rating > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{item.rating}</span>
                <span className="text-xs text-white/30">({item.reviews} orders)</span>
              </div>
              )}
            </div>
            <p className="text-sm text-white/55 mt-1.5 leading-relaxed">{item.desc}</p>
            {item.prepMethod && (
              <p className="text-xs text-orange-300/80 mt-2">👨‍🍳 {item.prepMethod}</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Calories", value: item.calories ? `${item.calories}` : "—", unit: "kcal", icon: "🔥" },
              { label: "Protein", value: item.protein ? `${item.protein}` : "—", unit: "g", icon: "💪" },
              { label: "Carbs", value: item.carbs ? `${item.carbs}` : "—", unit: "g", icon: "🌾" },
              { label: "Cook Time", value: item.cookTime.replace(" min", ""), unit: "min", icon: "⏱️" },
            ].map(info => (
              <div key={info.label} className="rounded-xl bg-white/5 p-2.5 text-center">
                <div className="text-sm">{info.icon}</div>
                <div className="text-xs font-bold mt-0.5">{info.value}<span className="text-white/30 font-normal">{info.unit !== "min" ? info.unit : ""}</span></div>
                <div className="text-[10px] text-white/30">{info.label}</div>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-white/40 mb-1.5">Spice Level</p>
            <div className="flex gap-1 items-center">
              {[1, 2, 3].map(level => (
                <div key={level} className={`h-2.5 w-8 rounded-full ${level <= item.spice ? "bg-red-500" : "bg-white/10"}`} />
              ))}
              <span className="text-xs text-white/30 ml-2">{item.spice === 0 ? "Mild" : item.spice === 1 ? "Medium" : item.spice === 2 ? "Spicy" : "Very Spicy"}</span>
            </div>
          </div>

          {item.dietaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.dietaryTags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 capitalize">{tag}</span>
              ))}
            </div>
          )}

          {item.ingredients.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2">Ingredients</p>
              <div className="flex flex-wrap gap-1.5">
                {item.ingredients.map(ing => (
                  <span key={ing} className="px-2 py-1 bg-white/5 rounded-full text-xs text-white/60">{ing}</span>
                ))}
              </div>
            </div>
          )}

          {item.allergens.length > 0 && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <Info className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-yellow-400">Contains allergens</p>
                <p className="text-xs text-white/50 mt-0.5">{item.allergens.join(", ")}</p>
              </div>
            </div>
          )}

          {portionSizes.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Portion Size</p>
              <div className="flex flex-wrap gap-2">
                {portionSizes.map(p => (
                  <button
                    key={p.name}
                    onClick={() => setPortion(portion === p.name ? "" : p.name)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${portion === p.name ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/60"}`}
                  >
                    {p.name}{p.price > 0 ? ` +₹${p.price}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {opts.extraCheese && (
              <button
                onClick={() => setExtraCheese(v => !v)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs border transition-all ${extraCheese ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/60"}`}
              >
                🧀 {opts.extraCheese.label}{opts.extraCheese.price ? ` +₹${opts.extraCheese.price}` : ""}
              </button>
            )}
            {opts.extraSpicy && (
              <button
                onClick={() => setExtraSpicy(v => !v)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs border transition-all ${extraSpicy ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-white/5 border-white/10 text-white/60"}`}
              >
                🌶️ {opts.extraSpicy.label}
              </button>
            )}
          </div>

          {removeOptions.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Remove Ingredients</p>
              <div className="flex flex-wrap gap-2">
                {removeOptions.map(c => (
                  <button key={c} onClick={() => toggleCustom(c)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${selectedCustom.includes(c) ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/60"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {toppings.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Toppings</p>
              <div className="space-y-2">
                {toppings.map(t => (
                  <button key={t.name} onClick={() => toggleAddon(t)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${selectedAddons.find(x => x.name === t.name) ? "bg-orange-500/10 border-orange-500/40 text-white" : "bg-white/5 border-white/10 text-white/60"}`}>
                    <span>{t.name}</span>
                    <span className="text-orange-400 font-semibold">+₹{t.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {comboUpgrades.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Combo Upgrades</p>
              <div className="space-y-2">
                {comboUpgrades.map(c => (
                  <button key={c.name} onClick={() => toggleAddon(c)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${selectedAddons.find(x => x.name === c.name) ? "bg-violet-500/10 border-violet-500/40 text-white" : "bg-white/5 border-white/10 text-white/60"}`}>
                    <span>{c.name}</span>
                    <span className="text-violet-400 font-semibold">+₹{c.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.addons.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Add-ons</p>
              <div className="space-y-2">
                {item.addons.map(a => (
                  <button key={a.name} onClick={() => toggleAddon(a)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${selectedAddons.find(x => x.name === a.name) ? "bg-orange-500/10 border-orange-500/40 text-white" : "bg-white/5 border-white/10 text-white/60"}`}>
                    <span>{a.name}</span>
                    <span className="text-orange-400 font-semibold">+₹{a.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-2">Cooking Instructions</p>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-orange-500/40 resize-none"
              rows={2}
              placeholder="Allergy notes, doneness, spice preferences..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            {readOnly ? (
              <div className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-center text-sm font-semibold text-white/50">
                🔒 Demo menu — view only
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-1">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center font-bold">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="h-9 w-9 rounded-lg bg-orange-500 hover:bg-orange-400 flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => { onAdd(allCustomizations, selectedAddons, instructions, unitPrice); onClose(); }}
                  className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Order · ₹{total}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const [, navigate] = useAppLocation();
  const { addToCart, cart, updateQuantity, cartCount, cartTotal, activeRestaurant, activeTable, activeSection, dietaryFilter, setDietaryFilter, setActiveRestaurant, setActiveTable, loadVenue, venue, user, favorites } = useUser();
  // Demo menu (the marketing "spice-garden" venue) is VIEW-ONLY: no login, no ordering —
  // visitors can browse the menu but cannot add to cart or check out.
  const urlSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("slug") : null;
  const isDemo = (urlSlug ?? (venue as { restaurantSlug?: string })?.restaurantSlug) === DEMO_SLUG;
  const { t, speakMenuItem, accessibility, announce } = useLocaleAccessibility();
  const { loadMenuWithCache, isOnline, connectionStatus, settings, pendingOrders } = useOffline();
  const { canInstall, isStandalone, installApp } = usePwa();
  const [menuFromCache, setMenuFromCache] = useState(false);
  // The guest's active (unbilled) order, restored on reopen so they see it + can edit it.
  const [activeOrder, setActiveOrder] = useState<{ id: string; total: number; status: string; items: { menuItemId?: number | string; id?: number | string; name: string; quantity?: number; qty?: number; customizations?: string[]; addons?: unknown[]; variant?: string }[] } | null>(null);
  const OPEN_ORDER = ["new", "pending", "accepted", "confirmed", "preparing", "ready", "serving", "served"];
  async function refreshActiveOrder() {
    const ref = loadActiveOrder();
    if (!ref?.id) { setActiveOrder(null); return; }
    try {
      const o = await publicApi.getOrder(ref.id);
      const status = String(o?.status ?? "").toLowerCase();
      if (!o || !OPEN_ORDER.includes(status)) { clearActiveOrder(); setActiveOrder(null); return; }
      setActiveOrder({ id: String(o.id), total: parseFloat(String(o.total)) || 0, status, items: Array.isArray(o.items) ? o.items : [] });
    } catch { setActiveOrder(null); }
  }
  useEffect(() => { refreshActiveOrder(); /* eslint-disable-next-line */ }, []);
  // Quantity of a menu item already in the active order (plain lines only — no customizations).
  function orderedQtyOf(itemId: string) {
    if (!activeOrder) return 0;
    return activeOrder.items
      .filter(i => String(i.menuItemId ?? i.id) === String(itemId) && (!i.customizations || i.customizations.length === 0) && (!i.addons || (i.addons as unknown[]).length === 0) && !i.variant)
      .reduce((s, i) => s + (i.quantity ?? i.qty ?? 1), 0);
  }
  async function adjustOrdered(itemId: string, delta: number) {
    if (!activeOrder) return;
    try { await publicApi.adjustOrderItem(activeOrder.id, Number(itemId), delta); await refreshActiveOrder(); }
    catch { /* order may be locked (already prepared) */ await refreshActiveOrder(); }
  }
  const [activeCategory, setActiveCategory] = useState("all");
  const [categoryGroup, setCategoryGroup] = useState<CategoryGroup>("all");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuDisplayItem | null>(null);
  const [showWaiterPanel, setShowWaiterPanel] = useState(false);
  const [waiterSent, setWaiterSent] = useState<string | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "rating" | "popular">("default");
  const [menuItems, setMenuItems] = useState<MenuDisplayItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string; icon: string; group: string }[]>([{ id: "all", label: "All", icon: "🍽️", group: "all" }]);
  const [featuredItems, setFeaturedItems] = useState<MenuDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [aiForYou, setAiForYou] = useState<{ menuItemId: number; name: string; score: number; reason: string; price: number }[]>([]);

  useEffect(() => {
    if (!venue.restaurantId) return;
    publicApi.ai.personalizedMenu(venue.restaurantId, dietaryFilter)
      .then(r => setAiForYou(r.personalizedMenu ?? []))
      .catch(() => setAiForYou([]));
  }, [venue.restaurantId, dietaryFilter, favorites]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = resolveGuestSlug(venue.restaurantSlug) || params.get("slug") || "";
    if (!slug) {
      setLoading(false);
      setMenuError("no_venue");
      return;
    }
    const venueParams = {
      table: params.get("table") || undefined,
      room: params.get("room") || undefined,
      section: params.get("section") || undefined,
      branch: params.get("branch") || undefined,
      lang: params.get("lang") || undefined,
      entry: params.get("entry") || params.get("via") || undefined,
      zone: params.get("zone") || undefined,
      pool: params.get("pool") || undefined,
      spa: params.get("spa") || undefined,
      event: params.get("event") || undefined,
      parking: params.get("parking") || undefined,
      nfc: params.get("nfc") || undefined,
    };
    const table = venueParams.table;
    setLoading(true);
    setMenuError("");
    loadVenue(slug, venueParams).catch(() => {});
    loadMenuWithCache(slug, table, () => publicApi.menu(slug, table))
      .then(({ data, fromCache }) => {
        setMenuFromCache(fromCache);
        applyMenuData(data);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        const status = (err as { status?: number }).status;
        if (status === 404 || msg.toLowerCase().includes("not found")) {
          setMenuError("not_found");
        } else {
          setMenuError("connection");
        }
        setMenuItems([]);
        setCategories([{ id: "all", label: "All", icon: "🍽️", group: "all" }]);
        setFeaturedItems([]);
      }).finally(() => setLoading(false));

    function applyMenuData(data: Record<string, unknown>) {
      const restaurant = data.restaurant as { name?: string } | undefined;
      const table = data.table as { name?: string } | undefined;
      const restaurantRating = parseFloat(String(data.avgRating ?? 0)) || 0;
      if (restaurant?.name) setActiveRestaurant(restaurant.name);
      if (table?.name) setActiveTable(table.name);
      const cats = Array.isArray(data.categories) ? data.categories : [];
      const catTabs = [
        { id: "all", label: "All", icon: "🍽️", group: "all" },
        ...cats.map((c: Record<string, unknown>) => ({
          id: String(c.slug || c.id),
          label: String(c.name),
          icon: categoryIcon(String(c.name), String(c.slug || "")),
          group: String(c.categoryGroup || "food"),
        })),
      ];
      setCategories(catTabs);
      const items = cats.flatMap((c: Record<string, unknown>) => {
        const catSlug = String(c.slug || c.id);
        const catGroup = String(c.categoryGroup || "food");
        return ((c.items as Record<string, unknown>[]) || []).map(i => mapApiItem(i, catSlug, catGroup, restaurantRating));
      });
      setMenuItems(items);
      const featured = Array.isArray(data.featuredItems)
        ? data.featuredItems.map((i: Record<string, unknown>) => {
            const cat = cats.find((c: Record<string, unknown>) => c.id === i.categoryId);
            return mapApiItem(i, String(cat?.slug || i.categoryId || "main-course"), String(cat?.categoryGroup || "food"), restaurantRating);
          })
        : [];
      setFeaturedItems(featured.length > 0 ? featured : items.filter(i => i.badges.includes("bestseller") || i.chefRecommended));
    }
  }, [setActiveRestaurant, setActiveTable, loadVenue]);

  const visibleCategories = categories.filter(c => c.id === "all" || categoryGroup === "all" || c.group === categoryGroup);

  const filteredItems = menuItems
    .filter(item => {
      const groupMatch = categoryGroup === "all" || item.categoryGroup === categoryGroup;
      const catMatch = activeCategory === "all" || item.category === activeCategory;
      const dietMatch = matchesDietaryFilter(item.dietaryTags, dietaryFilter);
      const searchMatch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase());
      return groupMatch && catMatch && dietMatch && searchMatch;
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "popular") return b.reviews - a.reviews;
      return 0;
    });

  async function handleAdd(item: MenuDisplayItem, customizations: string[], addons: { name: string; price: number }[], instructions?: string, unitPrice?: number) {
    if (isDemo) return; // demo menu is view-only — ordering disabled
    const beverageSlugs = ["soft-drinks", "coffee", "tea", "mocktails", "cocktails", "premium-liquor", "wine-menu", "beer-menu"];
    const course = item.category === "starters" ? "starter" : item.category === "desserts" ? "dessert" : beverageSlugs.includes(item.category) ? "beverage" : "main";
    // With a running (unbilled) order open, anything added — plain or customized, from the card
    // or the detail sheet — goes straight into that SAME order (the server merges it into the
    // open tab). This keeps one order + one bill and updates the live total/count immediately,
    // instead of quietly dropping the item into a separate cart the guest can't see.
    if (activeOrder && venue.restaurantId) {
      try {
        await publicApi.createOrder({
          restaurantId: venue.restaurantId,
          tableName: activeTable,
          type: "dine_in",
          items: [{ menuItemId: item.id, quantity: 1, unitPrice: unitPrice ?? item.price, addons, customizations, notes: instructions, course }],
        });
      } finally { await refreshActiveOrder(); }
      return;
    }
    const linePrice = unitPrice ?? item.price + addons.reduce((s, a) => s + a.price, 0);
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: linePrice,
      quantity: 1,
      customizations,
      addons,
      specialInstructions: instructions,
      course,
    });
  }

  function callWaiter(request: string, type?: string) {
    if (venue.restaurantId) {
      publicApi.waiterCall({
        restaurantId: venue.restaurantId,
        tableId: venue.tableId,
        tableName: activeTable,
        type: type ?? request.toLowerCase().replace(/\s+/g, "_"),
        message: request,
      }).catch(() => {});
    }
    setWaiterSent(request);
    setTimeout(() => setWaiterSent(null), 3000);
    setShowWaiterPanel(false);
  }

  const slug = venue.restaurantSlug || resolveGuestSlug() || "";
  const SERVICE_LINKS = [
    { label: "Seating", path: "/user/seating", icon: "event_seat" },
    { label: "Reserve", path: "/user/reserve", icon: "calendar_month" },
    { label: "Queue", path: "/user/queue", icon: "hourglass_top" },
    { label: "Dining", path: "/user/dining", icon: "room_service" },
    { label: "Service", path: "/user/table-service", icon: "restaurant" },
    { label: "Hotel", path: venue.roomNumber ? `/user/hotel?room=${venue.roomNumber}` : "/user/hotel", icon: "hotel" },
    { label: "Events", path: "/user/events", icon: "celebration" },
    { label: "Spa", path: `/user/spa?slug=${slug}`, icon: "spa" },
    { label: "Bar", path: `/user/bar?slug=${slug}`, icon: "local_bar" },
    { label: "Wallet", path: "/user/wallet", icon: "account_balance_wallet" },
    { label: "Pay", path: "/user/payment", icon: "payments" },
    { label: "Loyalty", path: "/user/loyalty", icon: "loyalty" },
    { label: "AI For You", path: `/user/ai?slug=${slug}`, icon: "psychology" },
    { label: "Reviews", path: `/user/reviews?slug=${slug}`, icon: "rate_review" },
    { label: "Experience", path: `/user/experience?slug=${slug}`, icon: "auto_awesome" },
    { label: "Kiosk", path: `/user/kiosk?slug=${slug}`, icon: "point_of_sale" },
    { label: "PWA App", path: `/user/pwa?slug=${slug}`, icon: "install_mobile" },
    { label: "Offline", path: `/user/offline?slug=${slug}`, icon: "cloud_off" },
    { label: "Language", path: `/user/language?slug=${slug}`, icon: "translate" },
    { label: "Support", path: `/user/support?slug=${slug}`, icon: "support_agent" },
  ];

  const activeFilterCount = [
    categoryGroup !== "all",
    dietaryFilter !== "all",
    activeCategory !== "all",
    sortBy !== "default",
  ].filter(Boolean).length;

  function clearAllFilters() {
    setCategoryGroup("all");
    setDietaryFilter("all");
    setActiveCategory("all");
    setSortBy("default");
  }

  const WAITER_REQUESTS = TABLE_INTERACTION_REQUESTS.map(r => ({ icon: r.icon, label: r.label, type: r.type }));

  return (
    <div className="menu-page thin-scroll">
      <div className="menu-sticky-head">
      <header className="menu-app__top">
        <div className="menu-app__brand-row">
          <GuestBackButton fallback="/" />
          <div className="menu-app__brand">
            {/* Restaurant name only — no table/section subtitle, per the minimal header. */}
            <h1 className="menu-app__title">{isDemo ? "Demo Menu" : activeRestaurant}</h1>
          </div>
          {/* Header kept intentionally minimal: restaurant name only — no services/explore or
              profile/sign-in buttons. Back, search and filter are the only controls. */}
        </div>

        <div className="menu-app__search-row">
          <div className="menu-app__search">
            <Search className="menu-app__search-icon h-4 w-4" />
            <input
              type="search"
              placeholder={t("search")}
              aria-label={t("search")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilterSheet(true)}
            className="menu-app__icon-btn"
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="menu-app__badge">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </header>

      <nav className="menu-app__cats" aria-label="Categories">
        <div className="menu-app__cats-track thin-scroll">
          {visibleCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`menu-app__cat ${activeCategory === cat.id ? "menu-app__cat--active" : ""}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </nav>
      </div>

      <main className="menu-page__main">
          <div className="menu-app__promo">
            <div>
              <p className="text-[11px] font-semibold text-orange-300">Happy Hour · 3–6 PM</p>
              <p className="text-sm font-bold mt-0.5">20% off beverages</p>
            </div>
            <Icon name="local_bar" size={26} className="text-orange-400 shrink-0" />
          </div>

          {loading && (
            <div className="menu-skeleton">
              <div className="menu-skeleton__icon" />
              <p className="font-semibold text-sm">Loading menu…</p>
            </div>
          )}

          {menuError && !loading && (
            <div className="py-8">
              {menuError === "not_found" || menuError === "no_venue" ? (
                <GuestEmpty
                  title="No menu data found"
                  message="This restaurant has no menu yet, or the venue link is invalid. Try another venue or ask staff for a QR code."
                />
              ) : (
                <GuestEmpty
                  title="Could not load menu"
                  message="Please check your connection and try again."
                />
              )}
            </div>
          )}

          {!loading && !menuError && (
            <>
              {/* Chef's Specials — the restaurant's 2-4 highlighted signature dishes (items the
                  owner marked "Featured"). A prominent scrollable strip at the top of the menu. */}
              {featuredItems.length > 0 && !search && (
                <section className="mb-4">
                  <div className="flex items-center gap-2 mb-2 px-0.5">
                    <span className="text-base">✨</span>
                    <h2 className="text-sm font-extrabold tracking-tight">Chef's Specials</h2>
                    <span className="text-[11px] text-white/40">Must-try picks</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto thin-scroll pb-1 -mx-1 px-1 snap-x">
                    {featuredItems.slice(0, 4).map(item => (
                      <button
                        key={`special-${item.id}`}
                        type="button"
                        onClick={() => { setSelectedItem(item); announce(`${item.name} selected`); }}
                        className="snap-start shrink-0 w-40 text-left rounded-2xl overflow-hidden border border-amber-400/40 bg-gradient-to-b from-amber-500/15 to-transparent active:scale-[0.98] transition-transform"
                      >
                        <div className="relative h-24 w-full bg-white/5">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-2xl">🍽️</div>
                          )}
                          <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white shadow">⭐ Special</span>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-bold leading-tight truncate">{item.name}</p>
                          <p className="text-[13px] font-extrabold text-amber-300 mt-0.5">₹{item.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <p className="menu-app__count">
                {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
                {search ? (
                  <>
                    {" · "}
                    <button type="button" onClick={() => setSearch("")} className="text-orange-400">clear search</button>
                  </>
                ) : null}
              </p>

              {activeOrder && !isDemo && (
                <button
                  onClick={() => navigate(`/user/order/${activeOrder.id}`)}
                  className="w-full mb-3 flex items-center gap-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 px-4 py-3 text-left active:scale-[0.99] transition-transform"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-300">Your order is on the way 🍽️</p>
                    <p className="text-xs text-white/50">{activeOrder.items.length} item{activeOrder.items.length !== 1 ? "s" : ""} · ₹{activeOrder.total} · tap to track the timer</p>
                  </div>
                  <span className="text-emerald-300 text-sm font-bold shrink-0">Track →</span>
                </button>
              )}
              {activeOrder && !isDemo && (
                <p className="text-[11px] text-white/40 mb-3 px-1">Tap <b className="text-rose-300">−</b> on an item already in your order to remove it, or <b className="text-emerald-300">+</b> on anything new to add it to this same order.</p>
              )}
              <div className="menu-app__grid">
                {filteredItems.map(item => {
                  // With an active (unbilled) order, the card reflects what's already ordered and
                  // edits the order live (+/- ). Otherwise it controls the plain cart line.
                  const line = cart.find(c => c.menuItemId === item.id && (!c.customizations || c.customizations.length === 0));
                  const qty = activeOrder ? orderedQtyOf(item.id) : (line?.quantity ?? 0);
                  return (
                    <MenuGridCard
                      key={item.id}
                      item={item}
                      readOnly={isDemo}
                      quantity={qty}
                      onOpen={() => { setSelectedItem(item); announce(`${item.name} selected`); }}
                      onAdd={e => { e.stopPropagation(); if (activeOrder) adjustOrdered(item.id, 1); else handleAdd(item, [], []); announce(`${item.name} added to order`); }}
                      onIncrement={e => { e.stopPropagation(); if (activeOrder) adjustOrdered(item.id, 1); else handleAdd(item, [], []); }}
                      onDecrement={e => { e.stopPropagation(); if (activeOrder) adjustOrdered(item.id, -1); else if (line) updateQuantity(line.id, qty - 1); }}
                    />
                  );
                })}
              </div>

              {filteredItems.length === 0 && (
                <div className="col-span-2">
                  <GuestEmpty
                    title="No dishes found"
                    message={search ? "Try a different search or reset filters." : "This menu has no items yet."}
                    actionLabel={search ? "Reset filters" : undefined}
                    onAction={search ? clearAllFilters : undefined}
                  />
                </div>
              )}
            </>
          )}
      </main>

      {/* Waiter notification toast */}
      {waiterSent && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm flex items-center gap-2 animate-bounce">
          ✅ {waiterSent} — Waiter notified!
        </div>
      )}

      {/* Waiter Panel */}
      {showWaiterPanel && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full bg-guest-elevated rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Request Service</h3>
              <button onClick={() => setShowWaiterPanel(false)}><X className="h-5 w-5 text-white/50" /></button>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4">
              <Phone className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-xs font-semibold text-blue-300">Your Waiter</p>
                <p className="text-xs text-white/50">Rahul Kumar is serving your table</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {WAITER_REQUESTS.map(r => (
                <button key={r.label} onClick={() => callWaiter(r.label, r.type)} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 transition-all">
                  <span className="text-2xl">{r.icon}</span>
                  <span className="text-xs text-white/70 text-center leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isDemo ? (
        <footer className="menu-app__cart">
          <div className="max-w-lg mx-auto text-center text-xs font-semibold text-white/50 py-1">
            🔒 This is a demo menu — for viewing only. Ordering is disabled.
          </div>
        </footer>
      ) : (
        <footer className="menu-app__cart">
          <div className="flex gap-2.5 max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => setShowWaiterPanel(true)}
              className="guest-btn-secondary h-12 w-12 shrink-0 p-0"
              aria-label="Call waiter"
            >
              <Bell className="h-5 w-5 text-orange-400" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/user/cart")}
              disabled={cartCount === 0}
              className="guest-btn-primary flex-1 h-12 justify-between px-4 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <ShoppingCart className="h-4 w-4" />
                {cartCount} {cartCount === 1 ? "item" : "items"}
              </span>
              <span className="text-sm font-bold">₹{cartTotal}</span>
            </button>
          </div>
        </footer>
      )}

      <MenuFilterSheet
        open={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        categoryGroup={categoryGroup}
        setCategoryGroup={setCategoryGroup}
        dietaryFilter={dietaryFilter}
        setDietaryFilter={setDietaryFilter}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        sortBy={sortBy}
        setSortBy={setSortBy}
        categories={categories}
      />

      <ServiceHubSheet
        open={showServiceSheet}
        links={SERVICE_LINKS}
        onClose={() => setShowServiceSheet(false)}
        onNavigate={navigate}
      />

      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAdd={(c, a, instr, unitPrice) => { handleAdd(selectedItem, c, a, instr, unitPrice); setSelectedItem(null); }}
          readOnly={isDemo}
        />
      )}
    </div>
  );
}
