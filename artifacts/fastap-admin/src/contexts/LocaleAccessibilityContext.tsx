import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from "react";
import { publicApi } from "@/lib/api";
import {
  LANGUAGES, DEFAULT_ACCESSIBILITY, TRANSLATIONS,
  type LanguageId, type AccessibilitySettings, type UiStringKey,
} from "@/lib/localeAccessibilityCatalog";

const LANG_KEY = "fastap_lang";
const A11Y_KEY = "fastap_a11y";

interface LocaleAccessibilityContextValue {
  language: LanguageId;
  accessibility: AccessibilitySettings;
  setLanguage: (lang: LanguageId) => void;
  setAccessibility: (patch: Partial<AccessibilitySettings>) => void;
  toggleAccessibility: (key: keyof AccessibilitySettings) => void;
  t: (key: UiStringKey) => string;
  speak: (text: string) => void;
  speakMenuItem: (name: string, price: number, description?: string) => void;
  announce: (message: string) => void;
  syncPreferences: () => Promise<void>;
}

const LocaleAccessibilityContext = createContext<LocaleAccessibilityContextValue | null>(null);

function loadStoredLanguage(): LanguageId {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v && TRANSLATIONS[v as LanguageId]) return v as LanguageId;
  } catch { /* ignore */ }
  return "en";
}

function loadStoredAccessibility(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(A11Y_KEY);
    if (raw) return { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_ACCESSIBILITY };
}

function applyDocumentSettings(lang: LanguageId, a11y: AccessibilitySettings) {
  const html = document.documentElement;
  html.lang = lang;
  html.setAttribute("data-text-size", a11y.largeText ? "large" : "normal");
  html.setAttribute("data-contrast", a11y.highContrast ? "high" : "normal");
  html.setAttribute("data-screen-reader", a11y.screenReader ? "on" : "off");
  html.setAttribute("data-voice-menu", a11y.voiceMenu ? "on" : "off");
}

export function LocaleAccessibilityProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageId>(loadStoredLanguage);
  const [accessibility, setAccessibilityState] = useState<AccessibilitySettings>(loadStoredAccessibility);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    applyDocumentSettings(language, accessibility);
    localStorage.setItem(LANG_KEY, language);
    localStorage.setItem(A11Y_KEY, JSON.stringify(accessibility));
  }, [language, accessibility]);

  useEffect(() => {
    publicApi.locale?.preferences?.().then((p: { language?: string; accessibility?: AccessibilitySettings }) => {
      if (p.language && TRANSLATIONS[p.language as LanguageId]) {
        setLanguageState(p.language as LanguageId);
      }
      if (p.accessibility) {
        setAccessibilityState(prev => ({ ...prev, ...p.accessibility }));
      }
    }).catch(() => {});
  }, []);

  const setLanguage = useCallback((lang: LanguageId) => {
    setLanguageState(lang);
    publicApi.locale?.savePreferences?.({ language: lang }).catch(() => {});
  }, []);

  const setAccessibility = useCallback((patch: Partial<AccessibilitySettings>) => {
    setAccessibilityState(prev => {
      const next = { ...prev, ...patch };
      publicApi.locale?.savePreferences?.({ accessibility: next }).catch(() => {});
      return next;
    });
  }, []);

  const toggleAccessibility = useCallback((key: keyof AccessibilitySettings) => {
    setAccessibility({ [key]: !accessibility[key] });
  }, [accessibility, setAccessibility]);

  const t = useCallback((key: UiStringKey) => {
    return TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }, [language]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN",
      mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN",
    };
    utter.lang = langMap[language] ?? "en-IN";
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
  }, [language]);

  const speakMenuItem = useCallback((name: string, price: number, description?: string) => {
    if (!accessibility.voiceMenu) return;
    const parts = [name, `${t("price")} ${price} rupees`];
    if (description) parts.push(description);
    speak(parts.join(". "));
  }, [accessibility.voiceMenu, speak, t]);

  const announce = useCallback((message: string) => {
    if (!accessibility.screenReader) return;
    setLiveMessage("");
    requestAnimationFrame(() => setLiveMessage(message));
  }, [accessibility.screenReader]);

  const syncPreferences = useCallback(async () => {
    await publicApi.locale?.savePreferences?.({ language, accessibility }).catch(() => {});
  }, [language, accessibility]);

  return (
    <LocaleAccessibilityContext.Provider value={{
      language, accessibility, setLanguage, setAccessibility, toggleAccessibility,
      t, speak, speakMenuItem, announce, syncPreferences,
    }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveMessage}
      </div>
    </LocaleAccessibilityContext.Provider>
  );
}

export function useLocaleAccessibility() {
  const ctx = useContext(LocaleAccessibilityContext);
  if (!ctx) {
    throw new Error("useLocaleAccessibility must be used within LocaleAccessibilityProvider");
  }
  return ctx;
}

/** Safe hook for optional usage outside provider during migration */
export function useLocaleAccessibilityOptional() {
  return useContext(LocaleAccessibilityContext);
}
