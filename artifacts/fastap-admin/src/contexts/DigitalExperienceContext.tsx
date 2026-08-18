import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from "react";
import { publicApi } from "@/lib/api";
import {
  FESTIVAL_THEMES, SEASONAL_ANIMATIONS, DIGITAL_PREFS_KEY,
  type FestivalThemeId, type SeasonalAnimationId,
} from "@/lib/digitalExperienceCatalog";

interface DigitalExperienceContextValue {
  festivalTheme: FestivalThemeId;
  seasonalAnimation: SeasonalAnimationId;
  setFestivalTheme: (theme: FestivalThemeId) => void;
  setSeasonalAnimation: (anim: SeasonalAnimationId) => void;
  syncPreferences: () => Promise<void>;
}

const DigitalExperienceContext = createContext<DigitalExperienceContextValue | null>(null);

function loadStored(): { festivalTheme: FestivalThemeId; seasonalAnimation: SeasonalAnimationId } {
  try {
    const raw = localStorage.getItem(DIGITAL_PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        festivalTheme: (p.festivalTheme ?? "default") as FestivalThemeId,
        seasonalAnimation: (p.seasonalAnimation ?? "none") as SeasonalAnimationId,
      };
    }
  } catch { /* ignore */ }
  return { festivalTheme: "default", seasonalAnimation: "none" };
}

function applyDocumentTheme(themeId: FestivalThemeId, animationId: SeasonalAnimationId) {
  const html = document.documentElement;
  html.setAttribute("data-festival-theme", themeId);
  html.setAttribute("data-seasonal-animation", animationId);
  const theme = FESTIVAL_THEMES.find(t => t.id === themeId);
  if (theme) {
    html.style.setProperty("--fest-primary", theme.primary);
    html.style.setProperty("--fest-secondary", theme.secondary);
    html.style.setProperty("--fest-accent", theme.accent);
  }
}

export function SeasonalAnimationOverlay() {
  const ctx = useContext(DigitalExperienceContext);
  const anim = ctx?.seasonalAnimation ?? "none";
  if (anim === "none") return null;

  const count = SEASONAL_ANIMATIONS.find(a => a.id === anim)?.particles ?? 20;
  const particles = Array.from({ length: Math.min(count, 50) }, (_, i) => i);

  return (
    <div className="seasonal-animation-layer pointer-events-none fixed inset-0 z-[9998] overflow-hidden" aria-hidden="true">
      {particles.map(i => (
        <span
          key={i}
          className={`seasonal-particle seasonal-particle--${anim}`}
          style={{
            left: `${(i * 37 + 13) % 100}%`,
            animationDelay: `${(i * 0.7) % 5}s`,
            animationDuration: `${3 + (i % 4)}s`,
          }}
        />
      ))}
    </div>
  );
}

export function DigitalExperienceProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [festivalTheme, setFestivalThemeState] = useState<FestivalThemeId>(stored.festivalTheme);
  const [seasonalAnimation, setSeasonalAnimationState] = useState<SeasonalAnimationId>(stored.seasonalAnimation);

  useEffect(() => {
    applyDocumentTheme(festivalTheme, seasonalAnimation);
    localStorage.setItem(DIGITAL_PREFS_KEY, JSON.stringify({ festivalTheme, seasonalAnimation }));
  }, [festivalTheme, seasonalAnimation]);

  const setFestivalTheme = useCallback((theme: FestivalThemeId) => {
    setFestivalThemeState(theme);
    publicApi.digitalExperience.savePreferences({ festivalTheme: theme, seasonalAnimation }).catch(() => {});
  }, [seasonalAnimation]);

  const setSeasonalAnimation = useCallback((anim: SeasonalAnimationId) => {
    setSeasonalAnimationState(anim);
    publicApi.digitalExperience.savePreferences({ festivalTheme, seasonalAnimation: anim }).catch(() => {});
  }, [festivalTheme]);

  const syncPreferences = useCallback(async () => {
    try {
      const prefs = await publicApi.digitalExperience.preferences();
      if (prefs.festivalTheme) setFestivalThemeState(prefs.festivalTheme);
      if (prefs.seasonalAnimation) setSeasonalAnimationState(prefs.seasonalAnimation);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { syncPreferences(); }, [syncPreferences]);

  return (
    <DigitalExperienceContext.Provider value={{
      festivalTheme, seasonalAnimation, setFestivalTheme, setSeasonalAnimation, syncPreferences,
    }}>
      <SeasonalAnimationOverlay />
      {children}
    </DigitalExperienceContext.Provider>
  );
}

export function useDigitalExperience() {
  const ctx = useContext(DigitalExperienceContext);
  if (!ctx) throw new Error("useDigitalExperience must be used within DigitalExperienceProvider");
  return ctx;
}
