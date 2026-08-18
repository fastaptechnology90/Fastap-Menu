import type { DietaryFilter } from "@/contexts/UserContext";
import { DIETARY_FILTERS, MENU_CATEGORY_CATALOG } from "@/lib/digitalMenuCatalog";
import { Icon } from "@/components/shared/Icon";
import { X } from "lucide-react";

type CategoryGroup = "all" | "food" | "beverage" | "special";
type SortBy = "default" | "price-asc" | "price-desc" | "rating" | "popular";

const GROUPS: { id: CategoryGroup; label: string; icon: string }[] = [
  { id: "all", label: "All Menus", icon: "restaurant_menu" },
  { id: "food", label: MENU_CATEGORY_CATALOG.food.label, icon: "lunch_dining" },
  { id: "beverage", label: MENU_CATEGORY_CATALOG.beverage.label, icon: "local_bar" },
  { id: "special", label: MENU_CATEGORY_CATALOG.special.label, icon: "auto_awesome" },
];

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "default", label: "Recommended" },
  { id: "popular", label: "Most popular" },
  { id: "rating", label: "Top rated" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

export function MenuFilterSheet({
  open,
  onClose,
  categoryGroup,
  setCategoryGroup,
  dietaryFilter,
  setDietaryFilter,
  activeCategory,
  setActiveCategory,
  sortBy,
  setSortBy,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categoryGroup: CategoryGroup;
  setCategoryGroup: (g: CategoryGroup) => void;
  dietaryFilter: DietaryFilter;
  setDietaryFilter: (f: DietaryFilter) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  categories: { id: string; label: string; icon: string; group: string }[];
}) {
  if (!open) return null;

  const visibleCategories = categories.filter(
    c => c.id === "all" || categoryGroup === "all" || c.group === categoryGroup,
  );

  return (
    <div className="guest-sheet-overlay" onClick={onClose}>
      <div className="guest-sheet guest-sheet--tall" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-base">Filters & sort</h3>
          <button type="button" onClick={onClose} className="menu-icon-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto max-h-[65vh] pr-1 no-scrollbar">
          <section>
            <p className="menu-filter-label">Sort by</p>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSortBy(opt.id)}
                  className={`filter-chip ${sortBy === opt.id ? "filter-chip--active" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="menu-filter-label">Menu type</p>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setCategoryGroup(g.id); setActiveCategory("all"); }}
                  className={`filter-chip ${categoryGroup === g.id ? "filter-chip--active filter-chip--violet" : ""}`}
                >
                  <Icon name={g.icon} size={14} />
                  {g.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="menu-filter-label">Dietary preference</p>
            <div className="flex flex-wrap gap-2">
              {DIETARY_FILTERS.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDietaryFilter(d.id as DietaryFilter)}
                  className={`filter-chip ${dietaryFilter === d.id ? "filter-chip--active" : ""}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="menu-filter-label">Category</p>
            <div className="flex flex-wrap gap-2">
              {visibleCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`filter-chip ${activeCategory === cat.id ? "filter-chip--active filter-chip--orange" : ""}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <button type="button" onClick={onClose} className="guest-btn-primary w-full mt-5 py-3.5">
          Show results
        </button>
      </div>
    </div>
  );
}

export function ActiveFilterChips({
  categoryGroup,
  dietaryFilter,
  activeCategory,
  sortBy,
  categories,
  onClear,
}: {
  categoryGroup: CategoryGroup;
  dietaryFilter: DietaryFilter;
  activeCategory: string;
  sortBy: SortBy;
  categories: { id: string; label: string }[];
  onClear: () => void;
}) {
  const chips: string[] = [];
  if (categoryGroup !== "all") chips.push(GROUPS.find(g => g.id === categoryGroup)?.label ?? categoryGroup);
  if (dietaryFilter !== "all") chips.push(DIETARY_FILTERS.find(d => d.id === dietaryFilter)?.label ?? dietaryFilter);
  if (activeCategory !== "all") chips.push(categories.find(c => c.id === activeCategory)?.label ?? activeCategory);
  if (sortBy !== "default") chips.push(SORT_OPTIONS.find(s => s.id === sortBy)?.label ?? sortBy);

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
      {chips.map(chip => (
        <span key={chip} className="active-filter-chip">{chip}</span>
      ))}
      <button type="button" onClick={onClear} className="text-xs text-orange-400 shrink-0 font-medium">
        Clear all
      </button>
    </div>
  );
}
