import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser, type DietaryFilter } from "@/contexts/UserContext";
import { useLocaleAccessibility } from "@/contexts/LocaleAccessibilityContext";
import { useOffline } from "@/contexts/OfflineContext";
import { usePwa } from "@/contexts/PwaContext";
import { publicApi } from "@/lib/api";
import { TABLE_INTERACTION_REQUESTS } from "@/lib/smartDiningCatalog";
import { useWaiterCalls, WaiterCallBanner, SERVICE_REQUEST_ICONS } from "@/components/user/WaiterCallStatus";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestEmpty } from "@/components/user/GuestApiState";
import { resolveGuestSlug } from "@/lib/guestDemo";
import { loadActiveOrders, removeActiveOrder, clearActiveOrder } from "@/lib/activeOrder";
import { MenuGridCard } from "@/components/user/MenuGridCard";
import { ServiceHubSheet } from "@/components/user/ServiceHubSheet";
import { MenuFilterSheet } from "@/components/user/MenuFilterSheet";
import { AppImage } from "@/components/shared/AppImage";
import { Preview360Viewer } from "@/components/user/Preview360Viewer";
import { Icon } from "@/components/shared/Icon";
import {
  Search, ShoppingCart, Bell, Star, Info, Check,
  ChefHat, Flame, Dumbbell, Wheat, Timer, Sparkles,
  Plus, Minus, X,
  SlidersHorizontal, Camera, Phone, RotateCw, Play, Image as ImageIcon, Grid3x3,
} from "lucide-react";

type CategoryGroup = "all" | "food" | "beverage" | "special";

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
  /** Minutes the kitchen records for this dish, when it records one. */
  prepTime?: number;
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
  // Portions the kitchen actually offers, each with the full price of that portion (a
  // "Half" at ₹210 is ₹210, not ₹210 on top of the full price).
  variants: { name: string; price: number }[];
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

/**
 * Only what this dish itself declares.
 *
 * A shared default set used to be merged in here, so every item — coffee and kulfi
 * included — offered "Extra Cheese +₹15", "Large +₹25" and "Make it a combo meal +₹99".
 * The server prices strictly from the dish's own `addons`, so none of those were ever
 * actually charged: the guest picked an option, watched the total go up on screen, and
 * then got a different bill. The server stopped merging the defaults; this is the other
 * half of that fix.
 */
function parseCustomization(raw: unknown): CustomizationOpts {
  if (typeof raw !== "object" || raw === null) return {};
  return { ...(raw as CustomizationOpts) };
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
  // A variant row is {name, price} where price is the full price of that portion. Older
  // rows are bare strings with no price; those are shown but priced at the base rate,
  // which is exactly what the server will do with them.
  const basePrice = (i.discountedPrice as number) ?? parseFloat(String(i.price ?? 0));
  const variants = Array.isArray(i.variants)
    ? (i.variants as unknown[]).map(v =>
        typeof v === "object" && v !== null
          ? { name: String((v as Record<string, unknown>).name ?? ""), price: parseFloat(String((v as Record<string, unknown>).price ?? basePrice)) || basePrice }
          : { name: String(v), price: basePrice },
      ).filter(v => v.name)
    : [];
  const customizations = variants.map(v => v.name);
  const custOpts = parseCustomization(i.customizationOptions);
  return {
    id: String(i.id),
    name: String(i.name),
    category: categorySlug,
    categoryGroup,
    price: basePrice,
    variants,
    dietaryTags: tags,
    rating: restaurantRating > 0 ? restaurantRating : 0,
    reviews: (i.orderCount as number) || 0,
    // A dish with no prep time recorded used to be labelled "15 min" on the card and
    // in the detail sheet. That number came from nowhere: the guest was told how long
    // their food would take by a literal in the source.
    cookTime: i.prepTime ? `${i.prepTime} min` : "",
    prepTime: typeof i.prepTime === "number" ? i.prepTime : undefined,
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

interface ItemDetailProps {
  item: MenuDisplayItem;
  onClose: () => void;
  onAdd: (customizations: string[], addons: MenuDisplayItem["addons"], instructions?: string, unitPrice?: number, variant?: string) => void;
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

  // The dish's own portions, at the dish's own prices. This used to fall back to inventing
  // a flat ₹25 surcharge for anything named "large", which matched nothing the kitchen or
  // the server knew about.
  const portionSizes = item.variants;

  const removeOptions = opts.removeIngredients ?? ["No onion", "No garlic", "No dairy", "No nuts"];
  const toppings = opts.toppings ?? [];
  const comboUpgrades = opts.comboUpgrades ?? [];

  function toggleCustom(c: string) {
    setSelectedCustom(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  }
  function toggleAddon(a: { name: string; price: number }) {
    setSelectedAddons(p => p.find(x => x.name === a.name) ? p.filter(x => x.name !== a.name) : [...p, a]);
  }

  // A chosen portion REPLACES the base price — that is how the server reads a variant, and
  // the two have to agree or the guest is shown one figure and billed another.
  const portionPrice = portionSizes.find(p => p.name === portion)?.price;
  const extrasPrice = (extraCheese ? (opts.extraCheese?.price ?? 0) : 0) + (extraSpicy ? (opts.extraSpicy?.price ?? 0) : 0);
  const unitPrice = (portionPrice ?? item.price) + extrasPrice + selectedAddons.reduce((s, a) => s + a.price, 0);
  const total = unitPrice * qty;

  const allCustomizations = [
    ...selectedCustom,
    ...(extraCheese ? [opts.extraCheese?.label ?? "Extra Cheese"] : []),
    ...(extraSpicy ? [opts.extraSpicy?.label ?? "Extra Spicy"] : []),
  ];

  const hasVideo = Boolean(item.videoUrl);
  const has360 = Boolean(item.preview360Url);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-guest-elevated rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="relative h-52">
          {mediaTab === "photo" ? (
            <AppImage src={item.imageUrl} alt={item.name} fallbackId={item.id} category={item.category} className="h-full w-full" iconFallback="restaurant_menu" />
          ) : mediaTab === "video" && item.videoUrl ? (
            <video src={item.videoUrl} controls autoPlay muted className="w-full h-full object-cover" />
          ) : mediaTab === "360" && item.preview360Url ? (
            <Preview360Viewer src={item.preview360Url} alt={`${item.name} 360`} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Camera className="h-16 w-16 text-muted-foreground" />
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
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${mediaTab === tab.id ? "bg-primary text-primary-foreground" : "bg-foreground/40 text-muted-foreground"}`}
              >
                <tab.icon className="h-3 w-3" />{tab.label}
              </button>
            ))}
          </div>
          <div className="absolute top-3 right-3">
            <button onClick={onClose} className="h-8 w-8 rounded-full bg-foreground/40 flex items-center justify-center hover:bg-foreground/40">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="absolute bottom-3 left-3 flex gap-1.5 flex-wrap">
            {item.badges.map(b => (
              <span key={b} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b === "bestseller" ? "bg-primary text-primary-foreground" : b === "trending" ? "bg-primary text-primary-foreground" : b === "chef-recommended" ? "bg-primary text-primary-foreground" : b === "chef-special" ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"}`}>
                {b === "bestseller" ? "Bestseller" : b === "trending" ? "Trending" : b === "chef-recommended" ? "Chef recommended" : b === "chef-special" ? "Chef special" : "New"}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-semibold">{item.name}</h3>
              {item.rating > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="text-sm font-semibold">{item.rating}</span>
                <span className="text-xs text-muted-foreground">({item.reviews} orders)</span>
              </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.desc}</p>
            {item.prepMethod && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><ChefHat className="h-3.5 w-3.5 text-primary shrink-0" />{item.prepMethod}</p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Calories", value: item.calories ? `${item.calories}` : "—", unit: "kcal", icon: Flame },
              { label: "Protein", value: item.protein ? `${item.protein}` : "—", unit: "g", icon: Dumbbell },
              { label: "Carbs", value: item.carbs ? `${item.carbs}` : "—", unit: "g", icon: Wheat },
              { label: "Cook time", value: item.cookTime ? item.cookTime.replace(" min", "") : "—", unit: item.cookTime ? "min" : "", icon: Timer },
            ].map(info => (
              <div key={info.label} className="rounded-xl bg-muted p-2.5 text-center">
                <info.icon className="h-4 w-4 mx-auto text-muted-foreground" />
                <div className="text-xs font-semibold mt-0.5">{info.value}<span className="text-muted-foreground font-normal">{info.unit !== "min" ? info.unit : ""}</span></div>
                <div className="text-2xs text-muted-foreground">{info.label}</div>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Spice Level</p>
            <div className="flex gap-1 items-center">
              {[1, 2, 3].map(level => (
                <div key={level} className={`h-2.5 w-8 rounded-full ${level <= item.spice ? "bg-danger" : "bg-muted"}`} />
              ))}
              <span className="text-xs text-muted-foreground ml-2">{item.spice === 0 ? "Mild" : item.spice === 1 ? "Medium" : item.spice === 2 ? "Spicy" : "Very Spicy"}</span>
            </div>
          </div>

          {item.dietaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.dietaryTags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-success-subtle border border-success-border rounded-full text-xs text-success capitalize">{tag}</span>
              ))}
            </div>
          )}

          {item.ingredients.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Ingredients</p>
              <div className="flex flex-wrap gap-1.5">
                {item.ingredients.map(ing => (
                  <span key={ing} className="px-2 py-1 bg-muted rounded-full text-xs text-muted-foreground">{ing}</span>
                ))}
              </div>
            </div>
          )}

          {item.allergens.length > 0 && (
            <div className="flex items-start gap-2 bg-warning-subtle border border-warning-border rounded-xl p-3">
              <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-warning">Contains allergens</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.allergens.join(", ")}</p>
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
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${portion === p.name ? "bg-muted border-primary text-primary" : "bg-muted border-border text-muted-foreground"}`}
                  >
                    {p.name} ₹{p.price}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {opts.extraCheese && (
              <button
                onClick={() => setExtraCheese(v => !v)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs border transition-all ${extraCheese ? "bg-muted border-primary text-primary" : "bg-muted border-border text-muted-foreground"}`}
              >
                {opts.extraCheese.label}{opts.extraCheese.price ? ` +₹${opts.extraCheese.price}` : ""}
              </button>
            )}
            {opts.extraSpicy && (
              <button
                onClick={() => setExtraSpicy(v => !v)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs border transition-all ${extraSpicy ? "bg-danger-subtle border-danger-border text-danger" : "bg-muted border-border text-muted-foreground"}`}
              >
                {opts.extraSpicy.label}
              </button>
            )}
          </div>

          {removeOptions.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Remove Ingredients</p>
              <div className="flex flex-wrap gap-2">
                {removeOptions.map(c => (
                  <button key={c} onClick={() => toggleCustom(c)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${selectedCustom.includes(c) ? "bg-muted border-primary text-primary" : "bg-muted border-border text-muted-foreground"}`}>
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
                  <button key={t.name} onClick={() => toggleAddon(t)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${selectedAddons.find(x => x.name === t.name) ? "bg-muted border-primary text-foreground" : "bg-muted border-border text-muted-foreground"}`}>
                    <span>{t.name}</span>
                    <span className="text-primary font-semibold">+₹{t.price}</span>
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
                  <button key={c.name} onClick={() => toggleAddon(c)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${selectedAddons.find(x => x.name === c.name) ? "bg-muted border-primary text-foreground" : "bg-muted border-border text-muted-foreground"}`}>
                    <span>{c.name}</span>
                    <span className="text-primary font-semibold">+₹{c.price}</span>
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
                  <button key={a.name} onClick={() => toggleAddon(a)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm ${selectedAddons.find(x => x.name === a.name) ? "bg-muted border-primary text-foreground" : "bg-muted border-border text-muted-foreground"}`}>
                    <span>{a.name}</span>
                    <span className="text-primary font-semibold">+₹{a.price}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-2">Cooking Instructions</p>
            <textarea
              className="w-full bg-muted border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              rows={2}
              placeholder="Allergy notes, doneness, spice preferences..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            {readOnly ? (
              <div className="flex-1 py-3 rounded-xl bg-muted border border-border text-center text-sm font-semibold text-muted-foreground">
                Demo menu — view only
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 bg-muted rounded-xl p-1">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="h-9 w-9 rounded-lg bg-muted hover:bg-muted flex items-center justify-center">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-6 text-center font-semibold">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="h-9 w-9 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => { onAdd(allCustomizations, selectedAddons, instructions, unitPrice, portion || undefined); onClose(); }}
                  className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-sm transition-all flex items-center justify-center gap-2"
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
  // The marketing preview menu is VIEW-ONLY: a visitor who arrived from the landing page
  // with no venue of their own can browse but not order.
  //
  // "No venue of their own" is the whole test, and it has to consider the context saved
  // when the guest scanned — not just the current URL. Comparing the raw ?slug (which is
  // absent on a reload or a link that dropped its query) against the demo alias put real
  // diners into the read-only preview and told them ordering was disabled while they were
  // sitting at a table. resolveGuestSlug returns null only when neither the URL nor the
  // saved scan knows a real venue.
  const isDemo = resolveGuestSlug((venue as { restaurantSlug?: string })?.restaurantSlug || undefined) === null;
  // Whether the kitchen is actually open, from the venue's own open/close times. A
  // venue that has published no hours is treated as open, which is what the server says.
  const venueClosed = venue.hours.hoursPublished && !venue.hours.isOpen;
  const { t, speakMenuItem, accessibility, announce } = useLocaleAccessibility();
  const { loadMenuWithCache, isOnline, connectionStatus, settings, pendingOrders } = useOffline();
  const { canInstall, isStandalone, installApp } = usePwa();
  const [menuFromCache, setMenuFromCache] = useState(false);
  // The guest's active (unbilled) orders — every round they've placed — restored on reopen so they
  // can track each one (progress + waiter) and edit the running order.
  type ActiveOrderInfo = { id: string; total: number; status: string; waiterName?: string; at: number; items: { menuItemId?: number | string; id?: number | string; name: string; quantity?: number; qty?: number; customizations?: string[]; addons?: unknown[]; variant?: string }[] };
  const [activeOrders, setActiveOrders] = useState<ActiveOrderInfo[]>([]);
  // The latest round — used for the card's ordered-qty / remove controls.
  const activeOrder = activeOrders.length ? activeOrders[activeOrders.length - 1] : null;
  const OPEN_ORDER = ["new", "pending", "accepted", "confirmed", "preparing", "ready", "serving", "served"];
  async function refreshActiveOrder() {
    const refs = loadActiveOrders();
    if (refs.length === 0) { setActiveOrders([]); return; }
    const fetched = await Promise.all(refs.map(async ref => {
      try {
        const o = await publicApi.getOrder(ref.id);
        const status = String(o?.status ?? "").toLowerCase();
        if (!o || !OPEN_ORDER.includes(status)) { removeActiveOrder(ref.id); return null; }
        return { id: String(o.id), total: parseFloat(String(o.total)) || 0, status, waiterName: o.waiterName ? String(o.waiterName) : undefined, at: ref.at ?? 0, items: Array.isArray(o.items) ? o.items : [] } as ActiveOrderInfo;
      } catch { return null; }
    }));
    setActiveOrders(fetched.filter((x): x is ActiveOrderInfo => x !== null).sort((a, b) => a.at - b.at));
  }
  useEffect(() => { refreshActiveOrder(); /* eslint-disable-next-line */ }, []);
  // How many of a menu item the guest has in the running order — counting EVERY line of the dish
  // (plain and customised), so a dish ordered with extras/removals also shows the "ordered" −.
  function orderedQtyOf(itemId: string) {
    if (!activeOrder) return 0;
    return activeOrder.items
      .filter(i => String(i.menuItemId ?? i.id) === String(itemId))
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
  const [waiterError, setWaiterError] = useState<string | null>(null);
  // Whether anybody has picked the table's calls up. Polled only while the service
  // sheet is open, so a guest reading the menu is not making a request every 15s.
  const { calls: waiterCalls, refresh: refreshWaiterCalls } = useWaiterCalls(venue.restaurantId, activeTable, showWaiterPanel);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showServiceSheet, setShowServiceSheet] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "rating" | "popular">("default");
  const [menuItems, setMenuItems] = useState<MenuDisplayItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string; icon: string; group: string }[]>([{ id: "all", label: "All", icon: "", group: "all" }]);
  const [featuredItems, setFeaturedItems] = useState<MenuDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [aiForYou, setAiForYou] = useState<{ menuItemId: number; name: string; score: number; reason: string; price: number }[]>([]);
  const [promo, setPromo] = useState<{ title: string; detail: string } | null>(null);

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
    // The menu load below owns the visible error; venue metadata failing on its
    // own only costs the header, so it must not blank the page.
    loadVenue(slug, venueParams).catch(() => undefined);
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
        setCategories([{ id: "all", label: "All", icon: "", group: "all" }]);
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
        { id: "all", label: "All", icon: "", group: "all" },
        ...cats.map((c: Record<string, unknown>) => ({
          id: String(c.slug || c.id),
          label: String(c.name),
          icon: "",
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

      // The promo strip used to be the words "Happy Hour · 3–6 PM / 20% off beverages",
      // hardcoded and shown to every venue, discounting nothing. Drive it from the
      // venue's own live campaigns, and show nothing when there are none.
      const today = new Date().toISOString().slice(0, 10);
      const campaigns = (Array.isArray(data.activeCampaigns) ? data.activeCampaigns : []) as Record<string, unknown>[];
      const live = campaigns.find(c =>
        c.isActive !== false
        && (!c.startDate || String(c.startDate).slice(0, 10) <= today)
        && (!c.endDate || String(c.endDate).slice(0, 10) >= today),
      );
      setPromo(live ? { title: String(live.name ?? ""), detail: String(live.description ?? "") } : null);
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

  async function handleAdd(item: MenuDisplayItem, customizations: string[], addons: { name: string; price: number }[], instructions?: string, unitPrice?: number, variant?: string) {
    if (isDemo) return; // demo menu is view-only — ordering disabled
    const beverageSlugs = ["soft-drinks", "coffee", "tea", "mocktails", "cocktails", "premium-liquor", "wine-menu", "beer-menu"];
    const course = item.category === "starters" ? "starter" : item.category === "desserts" ? "dessert" : beverageSlugs.includes(item.category) ? "beverage" : "main";
    // Everything the guest taps + on goes into the CART (even when they already have an order
    // running). Nothing is sent to the kitchen until they tap Place Order — which submits a new
    // order for the table. This is what stops a tap from silently placing an order on its own.
    // A chosen portion replaces the base price, matching how the server prices the line.
    const portionPrice = variant ? item.variants.find(v => v.name === variant)?.price : undefined;
    const linePrice = unitPrice ?? (portionPrice ?? item.price) + addons.reduce((s, a) => s + a.price, 0);
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: linePrice,
      quantity: 1,
      customizations,
      addons,
      variant,
      specialInstructions: instructions,
      course,
      allergens: item.allergens,
      prepTime: item.prepTime,
    });
  }

  async function callWaiter(request: string, type?: string) {
    if (!venue.restaurantId) return;
    try {
      await publicApi.waiterCall({
        restaurantId: venue.restaurantId,
        tableId: venue.tableId,
        tableName: activeTable,
        type: type ?? request.toLowerCase().replace(/\s+/g, "_"),
        message: request,
      });
    } catch {
      // "Waiter notified" for a call that never left the phone leaves a guest
      // waiting for someone who was never told.
      setWaiterError("We could not reach the staff. Please try again.");
      setTimeout(() => setWaiterError(null), 4000);
      return;
    }
    setWaiterSent(request);
    refreshWaiterCalls();
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

  const WAITER_REQUESTS = TABLE_INTERACTION_REQUESTS.map(r => ({ label: r.label, type: r.type }));

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

      {!venue.hours.isOpen && venue.hours.hoursPublished && (
        /* Nothing anywhere told a guest the venue was shut. The kitchen's own opening
           hours were in the database and unread, so a 4 a.m. order was taken in silence. */
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-subtle p-3" role="status">
          <Info className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-warning">Kitchen closed</p>
            <p className="text-xs text-muted-foreground mt-0.5">{venue.hours.message}</p>
            <p className="text-2xs text-muted-foreground mt-1">You can browse the menu — ordering opens at {venue.hours.openTime}.</p>
          </div>
        </div>
      )}

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
          {promo && (
            <div className="menu-app__promo">
              <div>
                <p className="text-2xs font-semibold text-primary">{promo.title}</p>
                {promo.detail && <p className="text-sm font-semibold mt-0.5">{promo.detail}</p>}
              </div>
              <Icon name="local_offer" size={26} className="text-primary shrink-0" />
            </div>
          )}

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
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold tracking-tight">Chef's Specials</h2>
                    <span className="text-2xs text-muted-foreground">Must-try picks</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto thin-scroll pb-1 -mx-1 px-1 snap-x">
                    {featuredItems.slice(0, 4).map(item => (
                      <button
                        key={`special-${item.id}`}
                        type="button"
                        onClick={() => { setSelectedItem(item); announce(`${item.name} selected`); }}
                        className="snap-start shrink-0 w-40 text-left rounded-2xl overflow-hidden border border-warning-border active:scale-[0.98] transition-transform"
                      >
                        <div className="relative h-24 w-full bg-muted">
                          <AppImage src={item.imageUrl} alt={item.name} fallbackId={item.id} category={item.category} className="h-full w-full" iconFallback="restaurant_menu" />
                          <span className="absolute top-1.5 left-1.5 text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow z-10">Special</span>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-semibold leading-tight truncate">{item.name}</p>
                          <p className="text-[13px] font-semibold text-warning mt-0.5">₹{item.price}</p>
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
                    <button type="button" onClick={() => setSearch("")} className="text-primary">clear search</button>
                  </>
                ) : null}
              </p>

              {activeOrders.length > 0 && !isDemo && (
                <div className="mb-3 space-y-2">
                  {activeOrders.map((ord, i) => {
                    const label = ord.status === "ready" ? "Ready to serve"
                      : ord.status === "preparing" ? "Being prepared"
                      : ord.status === "served" || ord.status === "serving" ? "On the way / served"
                      : ord.status === "accepted" || ord.status === "confirmed" ? "Accepted by kitchen"
                      : "Sent to kitchen";
                    return (
                      <button
                        key={ord.id}
                        onClick={() => navigate(`/user/order/${ord.id}`)}
                        className="w-full flex items-center gap-3 rounded-2xl bg-success-subtle border border-success-border px-4 py-3 text-left active:scale-[0.99] transition-transform"
                      >
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-success">{activeOrders.length > 1 ? `Order ${i + 1}` : "Your order"} · {label}</p>
                          <p className="text-xs text-muted-foreground truncate">{ord.items.length} item{ord.items.length !== 1 ? "s" : ""} · ₹{ord.total} · {ord.waiterName ? `waiter: ${ord.waiterName}` : "waiter being assigned"}</p>
                        </div>
                        <span className="text-success text-sm font-semibold shrink-0">Track →</span>
                      </button>
                    );
                  })}
                  <p className="text-2xs text-muted-foreground px-1">Want more? Add items with <b className="text-success">+</b>, then tap <b className="text-warning">Place Order</b> — it goes to your table as a new order.</p>
                </div>
              )}
              <div className="menu-app__grid">
                {filteredItems.map(item => {
                  // The +/- on a card only build the CART (add / remove) — nothing is ordered
                  // yet. The guest reviews the cart and taps "Place Order" to actually submit.
                  const line = cart.find(c => c.menuItemId === item.id && (!c.customizations || c.customizations.length === 0));
                  const qty = line?.quantity ?? 0;
                  return (
                    <MenuGridCard
                      key={item.id}
                      item={item}
                      readOnly={isDemo}
                      quantity={qty}
                      orderedQty={activeOrder ? orderedQtyOf(item.id) : 0}
                      onRemoveOrdered={e => { e.stopPropagation(); adjustOrdered(item.id, -1); }}
                      onOpen={() => { setSelectedItem(item); announce(`${item.name} selected`); }}
                      onAdd={e => { e.stopPropagation(); handleAdd(item, [], []); announce(`${item.name} added to cart`); }}
                      onIncrement={e => { e.stopPropagation(); handleAdd(item, [], []); }}
                      onDecrement={e => { e.stopPropagation(); if (line) updateQuantity(line.id, qty - 1); }}
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
      {waiterError && (
        <div role="alert" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-danger-subtle text-foreground text-sm font-semibold shadow-lg">
          {waiterError}
        </div>
      )}
      {waiterSent && (
        <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] bg-card border border-border px-4 py-2.5 rounded-md shadow-lg text-sm flex items-center gap-2">
          <Check className="h-4 w-4 text-success shrink-0" />
          {/* Was "Waiter notified!", which claims a person has seen it. The request is
              with the floor; whether anyone picked it up is shown in the panel. */}
          <span>{waiterSent} — sent to the floor</span>
        </div>
      )}

      {/* Waiter Panel */}
      {showWaiterPanel && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-end">
          <div className="w-full bg-guest-elevated rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Request Service</h3>
              <button onClick={() => setShowWaiterPanel(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="flex items-center gap-2.5 rounded-md bg-muted border border-border p-3 mb-3">
              <Phone className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium">{activeOrder?.waiterName ? "Your waiter" : "Table service"}</p>
                <p className="text-xs text-muted-foreground">{activeOrder?.waiterName ? `${activeOrder.waiterName} is serving your table` : "Tap a request below and it goes to the floor for your table."}</p>
              </div>
            </div>
            {waiterCalls.length > 0 && (
              <div className="mb-3"><WaiterCallBanner calls={waiterCalls} /></div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {WAITER_REQUESTS.map(r => {
                const RequestIcon = SERVICE_REQUEST_ICONS[r.type] ?? Bell;
                return (
                  <button
                    key={r.label}
                    onClick={() => callWaiter(r.label, r.type)}
                    className="flex flex-col items-center justify-center gap-2 p-3 min-h-[80px] rounded-md bg-muted border border-border hover:bg-accent transition-colors"
                  >
                    <RequestIcon className="h-5 w-5 text-primary" />
                    <span className="text-xs text-center leading-tight">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isDemo ? (
        <footer className="menu-app__cart">
          <div className="max-w-lg mx-auto text-center text-xs font-semibold text-muted-foreground py-1">
            This is a demo menu — for viewing only. Ordering is disabled.
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
              <Bell className="h-5 w-5 text-primary" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/user/cart")}
              disabled={cartCount === 0 || venueClosed}
              title={venueClosed ? venue.hours.message : undefined}
              className="guest-btn-primary flex-1 h-12 justify-between px-4 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ShoppingCart className="h-4 w-4" />
                {venueClosed ? `Opens ${venue.hours.openTime}` : `${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              </span>
              <span className="text-sm font-semibold">₹{cartTotal}</span>
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
          onAdd={(c, a, instr, unitPrice, variant) => { handleAdd(selectedItem, c, a, instr, unitPrice, variant); setSelectedItem(null); }}
          readOnly={isDemo}
        />
      )}
    </div>
  );
}
