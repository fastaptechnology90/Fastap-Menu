/**
 * One dish on the menu.
 *
 * A full-bleed row, not a tile in a two-column grid: the name gets the width it needs,
 * the description is readable rather than clipped at three words, and the add control
 * sits on the right edge where a thumb already is. Two dishes fit on a phone screen
 * instead of six half-legible ones.
 */
import type { MouseEvent } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { Plus, Minus, Star, Clock, Flame } from "lucide-react";
import { isVegItem, BADGE_LABELS, type MenuDisplayItem } from "./menuModel";

/** The FSSAI mark every Indian menu carries: a dot in a square, green for veg, red for not. */
export function VegMark({ veg }: { veg: boolean }) {
  return (
    <span
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      className={
        veg
          ? "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs border border-success-border"
          : "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs border border-danger-border"
      }
    >
      <span className={veg ? "block h-1.5 w-1.5 rounded-full bg-success" : "block h-1.5 w-1.5 rounded-full bg-danger"} />
    </span>
  );
}

export function MenuDishRow({
  item,
  quantity = 0,
  orderedQty = 0,
  readOnly = false,
  onOpen,
  onAdd,
  onIncrement,
  onDecrement,
  onRemoveOrdered,
}: {
  item: MenuDisplayItem;
  quantity?: number;
  /** How many of this dish are already with the kitchen on the running order. */
  orderedQty?: number;
  readOnly?: boolean;
  onOpen: () => void;
  onAdd: (e: MouseEvent) => void;
  onIncrement?: (e: MouseEvent) => void;
  onDecrement?: (e: MouseEvent) => void;
  onRemoveOrdered?: (e: MouseEvent) => void;
}) {
  const veg = isVegItem(item.dietaryTags);
  const badge = item.badges.find(b => BADGE_LABELS[b]);
  const canCustomise = item.variants.length > 0 || item.addons.length > 0;

  return (
    <article className="flex gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <span className="mb-1 flex items-center gap-2">
            <VegMark veg={veg} />
            {badge && (
              <span className="rounded-pill bg-warning-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                {BADGE_LABELS[badge]}
              </span>
            )}
          </span>
          <h3 className="text-[15px] font-semibold leading-snug">{item.name}</h3>
          <p className="mt-1 text-sm font-semibold tabular-nums">₹{item.price}</p>
          {(item.rating > 0 || item.cookTime || item.spice > 1) && (
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
              {item.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              {item.cookTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.cookTime}
                </span>
              )}
              {item.spice > 1 && (
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  {item.spice > 2 ? "Very spicy" : "Spicy"}
                </span>
              )}
            </span>
          )}
          {item.desc && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
          )}
        </button>
      </div>

      <div className="relative w-[104px] shrink-0">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${item.name}`}
          className="low-bandwidth-hide-image block h-[104px] w-full overflow-hidden rounded-md border border-border bg-muted"
        >
          <AppImage
            src={item.imageUrl}
            alt={item.name}
            fallbackId={item.id}
            category={item.category}
            className="h-full w-full"
            iconFallback="restaurant_menu"
          />
        </button>

        {!readOnly && (
          <div className="absolute -bottom-3 left-1/2 w-[92px] -translate-x-1/2">
            {quantity > 0 ? (
              <div className="flex h-9 items-center justify-between rounded-md border border-primary bg-card px-1 shadow-sm">
                <button
                  type="button"
                  onClick={onDecrement}
                  aria-label={`Remove one ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-primary"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <span className="text-sm font-semibold tabular-nums text-primary">{quantity}</span>
                <button
                  type="button"
                  onClick={onIncrement}
                  aria-label={`Add one ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-primary"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ) : orderedQty > 0 ? (
              // Already with the kitchen, as opposed to in the basket. The minus removes
              // one from that live order; the plus starts a fresh basket line.
              <div
                className="flex h-9 items-center justify-between rounded-md border border-success-border bg-success-subtle px-1 shadow-sm"
                title="In your order"
              >
                <button
                  type="button"
                  onClick={onRemoveOrdered}
                  aria-label={`Remove one ${item.name} from your order`}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-success"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <span className="text-sm font-semibold tabular-nums text-success">{orderedQty}</span>
                <button
                  type="button"
                  onClick={onAdd}
                  aria-label={`Add another ${item.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-success"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={canCustomise ? () => onOpen() : onAdd}
                aria-label={`Add ${item.name}`}
                className="flex h-9 w-full items-center justify-center gap-1 rounded-md border border-primary bg-card text-xs font-semibold uppercase tracking-wide text-primary shadow-sm transition-colors hover:bg-accent"
              >
                Add
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
        {!readOnly && canCustomise && quantity === 0 && orderedQty === 0 && (
          <p className="absolute -bottom-7 left-0 w-full text-center text-[10px] text-muted-foreground">
            customisable
          </p>
        )}
      </div>
    </article>
  );
}
