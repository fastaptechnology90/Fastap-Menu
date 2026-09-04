import { useEffect } from "react";
import { useUser } from "@/contexts/UserContext";
import { GuestPage } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { resolveGuestSlug, DEMO_SLUG } from "@/lib/guestDemo";
import { entryParamsForVenue } from "@/lib/smartEntry";

// Falls back to the scan-time context when the URL no longer carries
// ?table=/?room= (every page after the first), so a reload keeps the table.
const venueLoadParams = entryParamsForVenue;

export function GuestVenueRequired({ children }: { children: React.ReactNode }) {
  const { venue, venueLoading, venueError, loadVenue } = useUser();

  // A guest only ever sees ONE venue: the one their QR/link points to, or the demo
  // venue when there is no specific slug. We never list every venue on the platform —
  // that would expose all onboarded restaurants' names (a privacy leak). Reported by
  // the client during acceptance testing.
  const slug = resolveGuestSlug(venue.restaurantSlug || undefined) ?? DEMO_SLUG;

  useEffect(() => {
    if (venue.restaurantId || venueLoading) return;
    loadVenue(slug, venueLoadParams()).catch(() => {});
  }, [slug, venue.restaurantId, venueLoading, loadVenue]);

  function retry() {
    loadVenue(slug, venueLoadParams()).catch(() => {});
  }

  if (!venue.restaurantId && venueError) {
    return (
      <GuestPage>
        <GuestError
          message="Please scan a valid restaurant QR code to open the menu."
          onRetry={retry}
        />
      </GuestPage>
    );
  }

  if (!venue.restaurantId) {
    return (
      <GuestPage>
        <GuestLoading label="Loading restaurant…" />
      </GuestPage>
    );
  }

  return <>{children}</>;
}
