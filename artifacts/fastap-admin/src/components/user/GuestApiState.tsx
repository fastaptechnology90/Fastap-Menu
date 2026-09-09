import { Loader2, RefreshCw, WifiOff, Store, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function GuestLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function GuestError({
  message = "Could not load data. Check that the API server is running.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="guest-section-card mx-4 my-8 text-center">
      <WifiOff className="h-10 w-10 text-danger mx-auto mb-3" />
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="guest-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}
    </div>
  );
}

export function GuestEmpty({
  message = "No data found.",
  title,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
}: {
  message?: string;
  title?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="guest-section-card mx-4 my-8 text-center py-10 px-6">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
      {title && <h2 className="font-display font-semibold text-lg text-foreground mb-2">{title}</h2>}
      <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="guest-btn-primary mt-6 px-6 py-2.5 text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export type PublicVenueOption = {
  id: number;
  name: string;
  slug: string;
  publicationStatus?: string;
};

export function GuestVenuePicker({
  venues,
  selectedSlug,
  onSelect,
  loading,
}: {
  venues: PublicVenueOption[];
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  loading?: boolean;
}) {
  if (venues.length === 0) {
    return (
      <GuestEmpty
        icon={Store}
        title="No restaurants found"
        message="There are no venues on this platform yet. Restaurant owners can register to get started."
        actionLabel="Register a restaurant"
        onAction={() => { window.location.href = "/restaurant/register"; }}
      />
    );
  }

  return (
    <div className="mx-auto my-6 space-y-2 max-w-md px-4">
      <p className="text-xs text-muted-foreground text-center mb-3">
        {selectedSlug ? "Choose another venue" : "Select a restaurant to continue"}
      </p>
      {venues.map(v => (
        <button
          key={v.slug}
          type="button"
          disabled={loading}
          onClick={() => onSelect(v.slug)}
          className={`w-full text-left guest-card guest-card-interactive p-4 flex items-center gap-3 ${
            selectedSlug === v.slug ? "ring-1 ring-primary" : ""
          }`}
        >
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{v.name}</p>
            <p className="text-xs text-muted-foreground truncate">{v.slug}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
