import { useEffect } from "react";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

/** Every event name the API broadcasts that a restaurant panel cares about. */
const SERVER_EVENTS = [
  "new_order",
  "order_status",
  "order_updated",
  "order_paid",
  "bill_requested",
  "table_cleared",
  "waiter_call",
  "waiter_assigned",
  "housekeeping_assigned",
  "room_service_assigned",
] as const;

export function useRestaurantSSE(onEvent: (event: string, data: unknown) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let closed = false;

    function connect() {
      es = new EventSource(`${BASE}/events`, { withCredentials: true });
      // The server broadcasts more than the order lifecycle — payment,
      // table-clear and bill-request events were being dropped here, so the
      // panel only caught up on its 15s poll.
      for (const name of SERVER_EVENTS) {
        es.addEventListener(name, e => {
          try { onEvent(name, JSON.parse((e as MessageEvent).data)); } catch { /* ignore */ }
        });
      }
      es.onerror = () => {
        es?.close();
        if (!closed) setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, [enabled, onEvent]);
}
