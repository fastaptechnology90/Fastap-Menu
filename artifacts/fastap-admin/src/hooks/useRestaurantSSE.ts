import { useEffect } from "react";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export function useRestaurantSSE(onEvent: (event: string, data: unknown) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let closed = false;

    function connect() {
      es = new EventSource(`${BASE}/events`, { withCredentials: true });
      es.addEventListener("new_order", e => {
        try { onEvent("new_order", JSON.parse(e.data)); } catch { /* ignore */ }
      });
      es.addEventListener("order_status", e => {
        try { onEvent("order_status", JSON.parse(e.data)); } catch { /* ignore */ }
      });
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
