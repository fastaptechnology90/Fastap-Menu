import { useCallback } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { withGuestQuery } from "@/lib/guestDemo";

/** Navigate between guest routes preserving slug/table/room/from context. */
export function useGuestNavigate() {
  const [, navigate] = useAppLocation();
  const { venue, activeTable } = useUser();

  return useCallback(
    (path: string) => navigate(withGuestQuery(path, venue, activeTable)),
    [navigate, venue, activeTable],
  );
}
