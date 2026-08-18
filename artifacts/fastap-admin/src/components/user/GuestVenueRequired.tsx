import { useEffect, useState } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { GuestPage } from "@/components/user/GuestUI";
import {
  GuestLoading,
  GuestError,
  GuestEmpty,
  GuestVenuePicker,
  type PublicVenueOption,
} from "@/components/user/GuestApiState";
import { resolveGuestSlug } from "@/lib/guestDemo";
import { parseEntryFromUrl } from "@/lib/smartEntry";
import { publicApi } from "@/lib/api";

function venueLoadParams() {
  const p = parseEntryFromUrl();
  return {
    table: p.table,
    room: p.room,
    section: p.section,
  };
}

export function GuestVenueRequired({ children }: { children: React.ReactNode }) {
  const [, navigate] = useAppLocation();
  const { venue, venueLoading, venueAttempted, venueError, loadVenue } = useUser();
  const [venues, setVenues] = useState<PublicVenueOption[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [picking, setPicking] = useState(false);

  const slug = resolveGuestSlug(venue.restaurantSlug || undefined);
  const venueNotFound =
    venueError === "venue_not_found"
    || (venueError?.toLowerCase().includes("venue not found") ?? false);
  const needsPicker = !venue.restaurantId && (venueNotFound || !slug || venueAttempted);

  useEffect(() => {
    publicApi.venues()
      .then(r => setVenues(Array.isArray(r.venues) ? r.venues : []))
      .catch(() => setVenues([]))
      .finally(() => setVenuesLoading(false));
  }, []);

  useEffect(() => {
    if (!slug || venue.restaurantId || venueLoading) return;
    loadVenue(slug, venueLoadParams()).catch(() => {});
  }, [slug, venue.restaurantId, venueLoading, loadVenue]);

  function pickVenue(nextSlug: string) {
    setPicking(true);
    const params = new URLSearchParams(window.location.search);
    params.set("slug", nextSlug);
    const qs = params.toString();
    navigate(`${window.location.pathname}?${qs}`, { replace: true });
    loadVenue(nextSlug, venueLoadParams())
      .catch(() => {})
      .finally(() => setPicking(false));
  }

  function retry() {
    const s = resolveGuestSlug(venue.restaurantSlug || undefined);
    if (s) loadVenue(s, venueLoadParams()).catch(() => {});
  }

  if (venuesLoading || (!venueAttempted && slug && venueLoading)) {
    return (
      <GuestPage>
        <GuestLoading label="Loading restaurant…" />
      </GuestPage>
    );
  }

  if (!venue.restaurantId && needsPicker) {
    if (venues.length === 0) {
      return (
        <GuestPage>
          <GuestEmpty
            title="No restaurants found"
            message="There is no venue data on this platform yet. Register a restaurant to enable guest menus, ordering, and guest experience features."
            actionLabel="Register a restaurant"
            onAction={() => navigate("/restaurant/register")}
          />
        </GuestPage>
      );
    }

    return (
      <GuestPage>
        <GuestEmpty
          title={venueNotFound ? "Venue not found" : "Select a restaurant"}
          message={
            venueNotFound
              ? "This link is outdated or the venue was removed. Pick an available restaurant below."
              : "Choose a restaurant to open the menu and guest experience."
          }
        />
        <GuestVenuePicker
          venues={venues}
          selectedSlug={slug ?? undefined}
          onSelect={pickVenue}
          loading={picking || venueLoading}
        />
      </GuestPage>
    );
  }

  if (venueError && !venue.restaurantId) {
    return (
      <GuestPage>
        <GuestError message={venueError} onRetry={retry} />
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
