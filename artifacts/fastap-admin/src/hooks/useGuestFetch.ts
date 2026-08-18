import { useState, useEffect, useCallback, useRef } from "react";

export function useGuestFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options?: { enabled?: boolean; initialData?: T },
) {
  const [data, setData] = useState<T | undefined>(options?.initialData);
  const [loading, setLoading] = useState(options?.enabled !== false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    if (options?.enabled === false) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setData(undefined);
    } finally {
      setLoading(false);
    }
  }, [options?.enabled]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload, setData };
}
