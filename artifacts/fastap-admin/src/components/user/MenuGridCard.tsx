import type { MouseEvent } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { Plus, Minus, Star } from "lucide-react";
import type { MenuItemCardData } from "./MenuItemCard";

function isVeg(tags: string[]) {
  const lower = tags.map(t => t.toLowerCase());
  return lower.some(t => t.includes("vegetarian") || t.includes("vegan") || t.includes("jain"))
    && !lower.some(t => t.includes("non-veg"));
}

export function MenuGridCard({
  item,
  onOpen,
  onAdd,
  quantity = 0,
  readOnly = false,
  onIncrement,
  onDecrement,
  orderedQty = 0,
  onRemoveOrdered,
}: {
  item: MenuItemCardData;
  onOpen: () => void;
  onAdd: (e: MouseEvent) => void;
  quantity?: number;
  readOnly?: boolean;
  onIncrement?: (e: MouseEvent) => void;
  onDecrement?: (e: MouseEvent) => void;
  // How many of this dish the guest has ALREADY ordered (in the running order). When >0 and it's
  // not in the cart, the card shows the ordered count with a − to remove it from the order.
  orderedQty?: number;
  onRemoveOrdered?: (e: MouseEvent) => void;
}) {
  const veg = isVeg(item.dietaryTags);

  return (
    <article className="menu-grid-card">
      <button type="button" onClick={onOpen} className="menu-grid-card__image low-bandwidth-hide-image">
        <AppImage
          src={item.imageUrl}
          alt={item.name}
          fallbackId={item.id}
          category={item.category}
          className="h-full w-full"
          iconFallback="restaurant_menu"
        />
        <span className={`menu-grid-card__veg ${veg ? "menu-grid-card__veg--yes" : "menu-grid-card__veg--no"}`} />
        {item.badges.includes("bestseller") && (
          <span className="menu-grid-card__tag">Bestseller</span>
        )}
      </button>
      <div className="menu-grid-card__body">
        <button type="button" onClick={onOpen} className="text-left w-full min-w-0">
          <h3 className="menu-grid-card__title">{item.name}</h3>
          <div className="menu-grid-card__meta">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
            <span>{item.rating.toFixed(1)}</span>
            <span>·</span>
            <span>{item.cookTime}</span>
          </div>
        </button>
        <div className="menu-grid-card__footer">
          <span className="menu-grid-card__price">₹{item.price}</span>
          {readOnly ? null : quantity > 0 ? (
            <div className="menu-grid-card__stepper">
              <button type="button" onClick={onDecrement} aria-label={`Remove one ${item.name}`}>
                <Minus className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <span>{quantity}</span>
              <button type="button" onClick={onIncrement} aria-label={`Add one ${item.name}`}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ) : orderedQty > 0 ? (
            // Already in the guest's running order: − removes one from that order (live), + adds
            // another to the cart. A dot marks it as "in your order".
            <div className="menu-grid-card__stepper menu-grid-card__stepper--ordered" title="In your order">
              <button type="button" onClick={onRemoveOrdered} aria-label={`Remove one ${item.name} from your order`}>
                <Minus className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <span>{orderedQty}</span>
              <button type="button" onClick={onAdd} aria-label={`Add another ${item.name}`}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={onAdd} className="menu-grid-card__add" aria-label={`Add ${item.name}`}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
