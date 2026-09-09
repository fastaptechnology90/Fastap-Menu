/**
 * Filters and sort, as a bottom sheet.
 *
 * Same four decisions as before — sort, menu type, dietary preference, category — but on
 * the shell's sheet primitive, so it drags, dismisses and clears the home indicator like
 * every other overlay in the guest app. The reset lives next to the apply button rather
 * than being unreachable once four filters were on.
 */
import { GuestSheet } from "@/components/user/GuestShell";
import { DIETARY_FILTERS, MENU_CATEGORY_CATALOG } from "@/lib/digitalMenuCatalog";
import type { DietaryFilter } from "@/contexts/UserContext";
import type { CategoryGroup, MenuCategoryTab, MenuSort } from "@/components/user/menuModel";

const GROUPS: { id: CategoryGroup; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "food", label: MENU_CATEGORY_CATALOG.food.label },
  { id: "beverage", label: MENU_CATEGORY_CATALOG.beverage.label },
  { id: "special", label: MENU_CATEGORY_CATALOG.special.label },
];

const SORT_OPTIONS: { id: MenuSort; label: string }[] = [
  { id: "default", label: "Recommended" },
  { id: "popular", label: "Most popular" },
  { id: "rating", label: "Top rated" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "min-h-9 rounded-pill border border-primary bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors"
          : "min-h-9 rounded-pill border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
      }
    >
      {label}
    </button>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-1">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

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
  activeCount,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  categoryGroup: CategoryGroup;
  setCategoryGroup: (g: CategoryGroup) => void;
  dietaryFilter: DietaryFilter;
  setDietaryFilter: (f: DietaryFilter) => void;
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  sortBy: MenuSort;
  setSortBy: (s: MenuSort) => void;
  categories: MenuCategoryTab[];
  activeCount: number;
  onClear: () => void;
}) {
  const visibleCategories = categories.filter(
    c => c.id === "all" || categoryGroup === "all" || c.group === categoryGroup,
  );

  return (
    <GuestSheet
      open={open}
      onClose={onClose}
      title="Filter & sort"
      size="tall"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClear}
            disabled={activeCount === 0}
            className="h-12 flex-1 rounded-md border border-border bg-card text-sm font-medium text-foreground transition-colors disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-[2] rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Show dishes
          </button>
        </div>
      }
    >
      <Block title="Sort by">
        {SORT_OPTIONS.map(o => (
          <Chip key={o.id} label={o.label} active={sortBy === o.id} onClick={() => setSortBy(o.id)} />
        ))}
      </Block>

      <Block title="Menu">
        {GROUPS.map(g => (
          <Chip
            key={g.id}
            label={g.label}
            active={categoryGroup === g.id}
            onClick={() => { setCategoryGroup(g.id); setActiveCategory("all"); }}
          />
        ))}
      </Block>

      <Block title="Dietary">
        {DIETARY_FILTERS.map(d => (
          <Chip
            key={d.id}
            label={d.label}
            active={dietaryFilter === d.id}
            onClick={() => setDietaryFilter(d.id as DietaryFilter)}
          />
        ))}
      </Block>

      <Block title="Category">
        {visibleCategories.map(c => (
          <Chip
            key={c.id}
            label={c.label}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
          />
        ))}
      </Block>
    </GuestSheet>
  );
}
