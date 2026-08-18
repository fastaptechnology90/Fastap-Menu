import { useGuestVenue } from "@/hooks/useGuestVenue";

/** Invisible wrapper — syncs slug/table/room from URL into UserContext. */
export function GuestVenueBootstrap() {
  useGuestVenue();
  return null;
}
