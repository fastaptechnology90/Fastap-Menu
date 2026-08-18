import { AppImage } from "@/components/shared/AppImage";
import { Icon } from "@/components/shared/Icon";
import { Clock, Plus, Star, Volume2 } from "lucide-react";

export interface MenuItemCardData {
  id: string;
  name: string;
  category: string;
  price: number;
  dietaryTags: string[];
  rating: number;
  cookTime: string;
  calories: number;
  badges: string[];
  desc: string;
  imageUrl?: string;
}

const BADGE_STYLES: Record<string, { className: string; icon: string; label: string }> = {
  bestseller: { className: "menu-badge menu-badge--gold", icon: "emoji_events", label: "Bestseller" },
  trending: { className: "menu-badge menu-badge--pink", icon: "local_fire_department", label: "Trending" },
  "chef-recommended": { className: "menu-badge menu-badge--amber", icon: "star", label: "Chef pick" },
  "chef-special": { className: "menu-badge menu-badge--violet", icon: "restaurant", label: "Special" },
};

function isVeg(tags: string[]) {
  const lower = tags.map(t => t.toLowerCase());
  return lower.some(t => t.includes("vegetarian") || t.includes("vegan") || t.includes("jain"))
    && !lower.some(t => t.includes("non-veg"));
}

export function MenuItemCard({
  item,
  onOpen,
  onAdd,
  onSpeak,
  showVoice,
  priceLabel = "Add",
}: {
  item: MenuItemCardData;
  onOpen: () => void;
  onAdd: () => void;
  onSpeak?: () => void;
  showVoice?: boolean;
  priceLabel?: string;
}) {
  const veg = isVeg(item.dietaryTags);

  return (
    <article className="menu-item-card group">
      <button type="button" onClick={onOpen} className="menu-item-card__media low-bandwidth-hide-image">
        <AppImage
          src={item.imageUrl}
          alt={item.name}
          fallbackId={item.id}
          category={item.category}
          className="h-full w-full"
          iconFallback="restaurant_menu"
        />
        {item.badges[0] && BADGE_STYLES[item.badges[0]] && (
          <span className={`menu-item-card__badge ${BADGE_STYLES[item.badges[0]].className}`}>
            <Icon name={BADGE_STYLES[item.badges[0]].icon} size={12} />
            {BADGE_STYLES[item.badges[0]].label}
          </span>
        )}
      </button>

      <div className="menu-item-card__body">
        <button type="button" onClick={onOpen} className="text-left w-full">
          <div className="flex items-start gap-2 mb-1">
            <span className={`menu-veg-dot ${veg ? "menu-veg-dot--veg" : "menu-veg-dot--nonveg"}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-[15px] leading-snug truncate">{item.name}</h3>
              {item.desc && (
                <p className="text-xs text-white/45 mt-0.5 line-clamp-1">{item.desc}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white/40 mb-2">
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {item.rating.toFixed(1)}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {item.cookTime}
            </span>
            {item.calories > 0 && (
              <>
                <span>·</span>
                <span>{item.calories} cal</span>
              </>
            )}
          </div>
        </button>

        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className="text-lg font-bold text-orange-400">₹{item.price}</span>
          <div className="flex items-center gap-1.5">
            {showVoice && onSpeak && (
              <button
                type="button"
                onClick={onSpeak}
                className="menu-icon-btn menu-icon-btn--violet"
                aria-label={`Listen to ${item.name}`}
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={onAdd} className="menu-add-btn">
              <Plus className="h-4 w-4" />
              {priceLabel}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
