import { useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { DEMO_SLUG, slugFromUrl, resolveGuestSlug } from "@/lib/guestDemo";
import { entryParamsForVenue } from "@/lib/smartEntry";

/** Load restaurant context from URL query on any /user/* route. */
export function useGuestVenue() {
  const [location] = useAppLocation();
  const { loadVenue } = useUser();

  useEffect(() => {
    if (!location.startsWith("/user")) return;
    // Read the URL first, then the context saved when the guest scanned. Taking only the
    // URL and falling straight through to the demo alias meant any guest route reached
    // without ?slug (a reload, a bookmark, a link that dropped the query) replaced the
    // real venue with the demo one — and the demo menu is view-only, so a diner sitting
    // at a table was told ordering was disabled.
    // …but an explicit slug in the URL still wins, demo alias included, so the
    // demo link cannot be redirected onto a real venue by a stale saved scan.
    const slug = slugFromUrl() ?? resolveGuestSlug() ?? DEMO_SLUG;
    // Scan-time context fills in table/room once the URL stops carrying them.
    loadVenue(slug, entryParamsForVenue()).catch(() => {});
  }, [location, loadVenue]);
}
