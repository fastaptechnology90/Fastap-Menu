import { useCallback, useSyncExternalStore } from "react";

/**
 * Day / night for the operator panels.
 *
 * One source of truth: the `dark` class on <html>, mirrored into localStorage so
 * the choice survives a reload. `index.html` reads that key before first paint,
 * so switching to light does not flash a dark screen on the way back in.
 *
 * Every mounted toggle stays in sync because they all subscribe to the same
 * store — flip it in the Super Admin header and the restaurant panel's own
 * switch moves with it rather than drifting out of step.
 */
const STORAGE_KEY = "fastap-theme";
const EVENT = "fastap-theme-change";

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` fires when another tab changes it — a manager with the floor plan
  // open in one tab and reports in another should not see two different themes.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      applyToDocument(e.newValue === "dark");
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

function getSnapshot(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

/** Server render has no document; the app ships dark by default. */
function getServerSnapshot(): boolean {
  return true;
}

function applyToDocument(dark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setDark = useCallback((dark: boolean) => {
    applyToDocument(dark);
    try { localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light"); } catch { /* private mode */ }
    emit();
  }, []);

  const toggle = useCallback(() => setDark(!getSnapshot()), [setDark]);

  return { isDark, setDark, toggle };
}
