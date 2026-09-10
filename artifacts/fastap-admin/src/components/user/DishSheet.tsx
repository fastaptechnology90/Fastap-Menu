/**
 * The dish detail, as a bottom sheet.
 *
 * It was a centre-anchored modal that filled 90% of a phone and put the quantity stepper
 * and the add button in the middle of the screen. Everything a diner has to reach — the
 * portion, the add-ons, the note, the quantity and the add button — now sits in the
 * bottom third, with the total on the button so nobody has to hunt for what they are
 * about to be charged.
 *
 * The pricing rules are carried across exactly as they were: a chosen portion REPLACES
 * the base price, because that is how the server prices a variant, and the two have to
 * agree or the guest is shown one figure and billed another.
 */
import { useEffect, useState, type ReactNode } from "react";
import { GuestSheet } from "@/components/user/GuestShell";
import { AppImage } from "@/components/shared/AppImage";
import { Preview360Viewer } from "@/components/user/Preview360Viewer";
import { VegMark } from "@/components/user/MenuDishRow";
import { isVegItem, type MenuDisplayItem } from "@/components/user/menuModel";
import {
  Minus, Plus, Star, Info, ChefHat, Flame, Timer, Image as ImageIcon, Play, RotateCw, Check,
} from "lucide-react";

export interface DishSelection {
  customizations: string[];
  addons: { name: string; price: number }[];
  instructions?: string;
  unitPrice: number;
  variant?: string;
  quantity: number;
}

/** A tappable option row: label on the left, price on the right, a tick when chosen. */
function OptionRow({
  label,
  price,
  selected,
  onClick,
  priceIsAbsolute = false,
}: {
  label: string;
  price?: number;
  selected: boolean;
  onClick: () => void;
  priceIsAbsolute?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        selected
          ? "flex min-h-11 w-full items-center gap-3 rounded-md border border-primary bg-accent px-3 py-2.5 text-left transition-colors"
          : "flex min-h-11 w-full items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors"
      }
    >
      <span
        className={
          selected
            ? "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            : "flex h-4.5 w-4.5 shrink-0 rounded-full border border-border"
        }
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      {price != null && price > 0 && (
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {priceIsAbsolute ? `₹${price}` : `+₹${price}`}
        </span>
      )}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[13px] font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function DishSheet({
  item,
  open,
  readOnly = false,
  onClose,
  onAdd,
}: {
  item: MenuDisplayItem | null;
  open: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onAdd: (item: MenuDisplayItem, selection: DishSelection) => void;
}) {
  const [qty, setQty] = useState(1);
  const [selectedCustom, setSelectedCustom] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{ name: string; price: number }[]>([]);
  const [instructions, setInstructions] = useState("");
  const [portion, setPortion] = useState("");
  const [extraCheese, setExtraCheese] = useState(false);
  const [extraSpicy, setExtraSpicy] = useState(false);
  const [mediaTab, setMediaTab] = useState<"photo" | "video" | "360">("photo");

  // A fresh dish is a fresh set of choices; carrying the previous dish's add-ons over was
  // how a coffee ended up with someone else's toppings on it.
  useEffect(() => {
    setQty(1);
    setSelectedCustom([]);
    setSelectedAddons([]);
    setInstructions("");
    setPortion("");
    setExtraCheese(false);
    setExtraSpicy(false);
    setMediaTab("photo");
  }, [item?.id]);

  if (!item) return null;

  const opts = item.customizationOptions;
  // The dish's own portions, at the dish's own prices. This used to fall back to inventing
  // a flat ₹25 surcharge for anything named "large", which matched nothing the kitchen or
  // the server knew about.
  const portionSizes = item.variants;
  const removeOptions = opts.removeIngredients ?? ["No onion", "No garlic", "No dairy", "No nuts"];
  const toppings = opts.toppings ?? [];
  const comboUpgrades = opts.comboUpgrades ?? [];

  const portionPrice = portionSizes.find(p => p.name === portion)?.price;
  const extrasPrice =
    (extraCheese ? (opts.extraCheese?.price ?? 0) : 0) + (extraSpicy ? (opts.extraSpicy?.price ?? 0) : 0);
  const unitPrice = (portionPrice ?? item.price) + extrasPrice + selectedAddons.reduce((s, a) => s + a.price, 0);
  const total = unitPrice * qty;

  const allCustomizations = [
    ...selectedCustom,
    ...(extraCheese ? [opts.extraCheese?.label ?? "Extra Cheese"] : []),
    ...(extraSpicy ? [opts.extraSpicy?.label ?? "Extra Spicy"] : []),
  ];

  function toggleCustom(c: string) {
    setSelectedCustom(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
  }
  function toggleAddon(a: { name: string; price: number }) {
    setSelectedAddons(p => p.find(x => x.name === a.name) ? p.filter(x => x.name !== a.name) : [...p, a]);
  }

  const mediaTabs = [
    { id: "photo" as const, label: "Photo", Icon: ImageIcon, show: Boolean(item.imageUrl) },
    { id: "video" as const, label: "Video", Icon: Play, show: Boolean(item.videoUrl) },
    { id: "360" as const, label: "360", Icon: RotateCw, show: Boolean(item.preview360Url) },
  ].filter(t => t.show);

  const meta = [
    item.calories ? { Icon: Flame, text: `${item.calories} kcal` } : null,
    item.cookTime ? { Icon: Timer, text: item.cookTime } : null,
    item.protein ? { Icon: null, text: `${item.protein}g protein` } : null,
  ].filter(Boolean) as { Icon: typeof Flame | null; text: string }[];

  return (
    <GuestSheet
      open={open}
      onClose={onClose}
      size="tall"
      footer={
        readOnly ? (
          <p className="py-1 text-center text-xs font-medium text-muted-foreground">
            Demo menu — for viewing only. Ordering is disabled.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-12 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-1">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                aria-label="Fewer"
                className="flex h-10 w-10 items-center justify-center rounded-sm text-foreground"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => setQty(q => q + 1)}
                aria-label="More"
                className="flex h-10 w-10 items-center justify-center rounded-sm text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onAdd(item, {
                  customizations: allCustomizations,
                  addons: selectedAddons,
                  instructions: instructions.trim() || undefined,
                  unitPrice,
                  variant: portion || undefined,
                  quantity: qty,
                });
                onClose();
              }}
              className="flex h-12 flex-1 items-center justify-between rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <span>Add to cart</span>
              <span className="tabular-nums">₹{total}</span>
            </button>
          </div>
        )
      }
    >
      <div className="-mx-4 -mt-1">
        <div className="relative h-44 w-full bg-muted">
          {mediaTab === "video" && item.videoUrl ? (
            <video src={item.videoUrl} controls autoPlay muted className="h-full w-full object-cover" />
          ) : mediaTab === "360" && item.preview360Url ? (
            <Preview360Viewer src={item.preview360Url} alt={`${item.name} in 360 degrees`} />
          ) : (
            <AppImage
              src={item.imageUrl}
              alt={item.name}
              fallbackId={item.id}
              category={item.category}
              className="h-full w-full"
              iconFallback="restaurant_menu"
            />
          )}
          {mediaTabs.length > 1 && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {mediaTabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMediaTab(t.id)}
                  className={
                    mediaTab === t.id
                      ? "flex items-center gap-1 rounded-pill bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                      : "flex items-center gap-1 rounded-pill bg-card/90 px-2.5 py-1 text-[11px] font-medium text-foreground"
                  }
                >
                  <t.Icon className="h-3 w-3" />
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <VegMark veg={isVegItem(item.dietaryTags)} />
              {item.dietaryTags.slice(0, 2).map(tag => (
                <span key={tag} className="rounded-pill bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="font-display text-lg font-semibold leading-tight">{item.name}</h2>
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums">₹{item.price}</p>
        </div>

        {(meta.length > 0 || item.rating > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                {item.rating.toFixed(1)}
                {item.reviews > 0 && <span>({item.reviews} orders)</span>}
              </span>
            )}
            {meta.map(m => (
              <span key={m.text} className="flex items-center gap-1">
                {m.Icon && <m.Icon className="h-3.5 w-3.5" />}
                {m.text}
              </span>
            ))}
          </div>
        )}

        {item.desc && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>}

        {item.prepMethod && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ChefHat className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {item.prepMethod}
          </p>
        )}

        {/* Allergens are the one thing on this sheet that must never be scrolled past. */}
        {item.allergens.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-warning">Contains allergens</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.allergens.join(", ")}</p>
            </div>
          </div>
        )}

        {portionSizes.length > 0 && (
          <Group title="Portion">
            {portionSizes.map(p => (
              <OptionRow
                key={p.name}
                label={p.name}
                price={p.price}
                priceIsAbsolute
                selected={portion === p.name}
                onClick={() => setPortion(portion === p.name ? "" : p.name)}
              />
            ))}
          </Group>
        )}

        {(opts.extraCheese || opts.extraSpicy) && (
          <Group title="Make it yours">
            {opts.extraCheese && (
              <OptionRow
                label={opts.extraCheese.label}
                price={opts.extraCheese.price}
                selected={extraCheese}
                onClick={() => setExtraCheese(v => !v)}
              />
            )}
            {opts.extraSpicy && (
              <OptionRow
                label={opts.extraSpicy.label}
                price={opts.extraSpicy.price}
                selected={extraSpicy}
                onClick={() => setExtraSpicy(v => !v)}
              />
            )}
          </Group>
        )}

        {toppings.length > 0 && (
          <Group title="Toppings">
            {toppings.map(t => (
              <OptionRow
                key={t.name}
                label={t.name}
                price={t.price}
                selected={Boolean(selectedAddons.find(x => x.name === t.name))}
                onClick={() => toggleAddon(t)}
              />
            ))}
          </Group>
        )}

        {comboUpgrades.length > 0 && (
          <Group title="Make it a combo">
            {comboUpgrades.map(c => (
              <OptionRow
                key={c.name}
                label={c.name}
                price={c.price}
                selected={Boolean(selectedAddons.find(x => x.name === c.name))}
                onClick={() => toggleAddon(c)}
              />
            ))}
          </Group>
        )}

        {item.addons.length > 0 && (
          <Group title="Add-ons">
            {item.addons.map(a => (
              <OptionRow
                key={a.name}
                label={a.name}
                price={a.price}
                selected={Boolean(selectedAddons.find(x => x.name === a.name))}
                onClick={() => toggleAddon(a)}
              />
            ))}
          </Group>
        )}

        {removeOptions.length > 0 && (
          <Group title="Leave out">
            <div className="flex flex-wrap gap-2">
              {removeOptions.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCustom(c)}
                  aria-pressed={selectedCustom.includes(c)}
                  className={
                    selectedCustom.includes(c)
                      ? "min-h-9 rounded-pill border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      : "min-h-9 rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </Group>
        )}

        {item.ingredients.length > 0 && (
          <Group title="Ingredients">
            <p className="text-xs leading-relaxed text-muted-foreground">{item.ingredients.join(" · ")}</p>
          </Group>
        )}

        <Group title="Note for the kitchen">
          <textarea
            rows={2}
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Allergies, doneness, spice preference…"
            className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
        </Group>
      </div>
    </GuestSheet>
  );
}
