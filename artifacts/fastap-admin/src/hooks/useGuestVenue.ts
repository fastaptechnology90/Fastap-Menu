import { useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { entryParamsForVenue } from "@/lib/smartEntry";

/** Load restaurant context from URL query on any /user/* route. */
export function useGuestVenue() {
  const [location] = useAppLocation();
  const { loadVenue } = useUser();

  useEffect(() => {
    if (!location.startsWith("/user")) return;
    const slug = new URLSearchParams(window.location.search).get("slug") || DEMO_SLUG;
    // Scan-time context fills in table/room once the URL stops carrying them.
    loadVenue(slug, entryParamsForVenue()).catch(() => {});
  }, [location, loadVenue]);
}
