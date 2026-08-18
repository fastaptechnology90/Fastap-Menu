import { useState, useEffect, useCallback } from "react";
import { publicApi } from "@/lib/api";
import {
  parseEntryFromUrl,
  detectAccessMethodClient,
  detectServiceModeClient,
  persistEntryContext,
  loadEntryContext,
  getDeviceId,
  type SmartEntryState,
  type SmartEntryParams,
} from "@/lib/smartEntry";

export function useSmartEntry(slug?: string) {
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [entry, setEntry] = useState<SmartEntryState | null>(null);

  const resolve = useCallback(async (override?: Partial<SmartEntryParams>) => {
    setLoading(true);
    const params = { ...parseEntryFromUrl(), ...override, slug: override?.slug || slug || parseEntryFromUrl().slug };
    const clientAccess = detectAccessMethodClient(params);
    const clientService = detectServiceModeClient(params, clientAccess);

    try {
      const data = await publicApi.venue(params.slug, {
        table: params.table,
        room: params.room,
        section: params.section,
        branch: params.branch,
        lang: params.lang,
        entry: params.entry,
        zone: params.zone,
        pool: params.pool,
        spa: params.spa,
        event: params.event,
        parking: params.parking,
        nfc: params.nfc,
        session: params.session,
      });

      const state: SmartEntryState = {
        params,
        detection: data.detection ?? {
          entryMethod: clientAccess,
          serviceMode: clientService,
          language: params.lang || "en",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        session: data.session ?? null,
        areaGroups: data.areaGroups,
      };
      setEntry(state);
      persistEntryContext(state);
      setOffline(false);

      if (data.session?.token) {
        const restored = await publicApi.session.restore(data.session.token).catch(() => null);
        if (restored?.cart?.length) {
          return { ...state, restoredCart: restored.cart };
        }
      }
      return state;
    } catch (err) {
      setEntry(null);
      setOffline(false);
      throw err instanceof Error ? err : new Error("venue_load_failed");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const saved = loadEntryContext();
    const run = () => resolve().catch(() => {});
    if (saved?.session?.token && !window.location.search.includes("session=")) {
      publicApi.session.restore(saved.session.token).catch(run);
    } else {
      run();
    }
  }, [resolve]);

  const joinShareCode = useCallback(async (shareCode: string) => {
    const result = await publicApi.session.join(shareCode, getDeviceId());
    if (entry) {
      const next = { ...entry, session: result.session };
      setEntry(next);
      persistEntryContext(next);
    }
    return result;
  }, [entry]);

  const createFamilySession = useCallback(async (restaurantId?: number, tableName?: string) => {
    const result = await publicApi.session.family(restaurantId, tableName);
    if (entry) {
      const next = { ...entry, session: result.session };
      setEntry(next);
      persistEntryContext(next);
    }
    return result;
  }, [entry]);

  const syncSession = useCallback(async (cart: unknown[]) => {
    await publicApi.session.sync(cart, getDeviceId()).catch(() => {});
  }, []);

  return { loading, offline, entry, resolve, joinShareCode, createFamilySession, syncSession };
}
