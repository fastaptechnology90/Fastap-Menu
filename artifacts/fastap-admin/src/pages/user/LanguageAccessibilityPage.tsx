import { useState, useEffect, useCallback } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useLocaleAccessibility } from "@/contexts/LocaleAccessibilityContext";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  LANGUAGES, ACCESSIBILITY_FEATURES,
  type LanguageId, type AccessibilityFeatureId,
} from "@/lib/localeAccessibilityCatalog";
import {
  ChevronLeft, Globe, Accessibility, Volume2, Type, Contrast, Eye,
  CheckCircle, Play, Square, Languages,
} from "lucide-react";

type Tab = "languages" | "accessibility" | "voice";

const A11Y_KEYS: Record<AccessibilityFeatureId, keyof import("@/lib/localeAccessibilityCatalog").AccessibilitySettings> = {
  voice_menu: "voiceMenu",
  large_text: "largeText",
  high_contrast: "highContrast",
  screen_reader: "screenReader",
};

const A11Y_ICONS: Record<AccessibilityFeatureId, typeof Volume2> = {
  voice_menu: Volume2, large_text: Type, high_contrast: Contrast, screen_reader: Eye,
};

export default function LanguageAccessibilityPage() {
  const [, navigate] = useAppLocation();
  const { venue, user } = useUser();
  const {
    language, accessibility, setLanguage, toggleAccessibility, t, speak, announce,
  } = useLocaleAccessibility();

  const [tab, setTab] = useState<Tab>("languages");
  const [toast, setToast] = useState<string | null>(null);
  const [voiceScript, setVoiceScript] = useState<string | null>(null);
  const [voiceItems, setVoiceItems] = useState<{ name: string; nameHi?: string; price: number }[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    announce(msg);
    setTimeout(() => setToast(null), 2500);
  }, [announce]);

  const loadVoiceMenu = useCallback(async () => {
    if (!venue.restaurantId) {
      setVoiceError("Restaurant not loaded.");
      return;
    }
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const r = await publicApi.locale.voiceMenu({
        restaurantId: venue.restaurantId,
        language,
      });
      setVoiceScript(r.script ?? null);
      setVoiceItems(r.items ?? []);
    } catch {
      setVoiceError("Could not load voice menu.");
      setVoiceScript(null);
      setVoiceItems([]);
    } finally {
      setVoiceLoading(false);
    }
  }, [venue.restaurantId, language]);

  useEffect(() => {
    if (tab !== "voice") return;
    loadVoiceMenu();
  }, [tab, loadVoiceMenu]);

  function selectLanguage(id: LanguageId) {
    setLanguage(id);
    showToast(`${LANGUAGES.find(l => l.id === id)?.native} selected`);
  }

  function toggleFeature(id: AccessibilityFeatureId) {
    const key = A11Y_KEYS[id];
    const wasEnabled = accessibility[key];
    toggleAccessibility(key);
    const label = ACCESSIBILITY_FEATURES.find(f => f.id === id)?.label ?? id;
    showToast(`${label} ${wasEnabled ? "disabled" : "enabled"}`);
  }

  function playVoiceMenu() {
    if (!voiceScript) return;
    setSpeaking(true);
    speak(voiceScript);
    setTimeout(() => setSpeaking(false), 3000);
  }

  function stopVoice() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  const nationalLangs = LANGUAGES.filter(l => l.region === "National");
  const regionalLangs = LANGUAGES.filter(l => l.region === "Regional");

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-white/40">{t("language")} & {t("accessibility")}</p>
            <h1 className="text-base font-bold flex items-center gap-2">
              <Languages className="h-4 w-4 text-indigo-400" /> Multi Language & Accessibility
            </h1>
          </div>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2" role="alert">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {([
            { id: "languages" as Tab, label: t("language"), icon: Globe },
            { id: "accessibility" as Tab, label: t("accessibility"), icon: Accessibility },
            { id: "voice" as Tab, label: t("voiceMenu"), icon: Volume2 },
          ]).map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium ${
                tab === item.id ? "bg-indigo-500/25 border border-indigo-500/40 text-indigo-200" : "bg-white/5 border border-white/10 text-white/60"
              }`}>
              <item.icon className="h-3 w-3" /> {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4">
        {/* Preview strip */}
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/25 p-4">
          <p className="text-sm text-indigo-200">
            {user?.name ? `${user.name.split(" ")[0]} · ` : ""}
            {LANGUAGES.find(l => l.id === language)?.native}
            {(accessibility.largeText || accessibility.highContrast || accessibility.voiceMenu || accessibility.screenReader) && " · "}
            {accessibility.largeText && "Large text · "}
            {accessibility.highContrast && "High contrast · "}
            {accessibility.voiceMenu && "Voice menu · "}
            {accessibility.screenReader && "Screen reader"}
          </p>
          <p className="text-xs text-white/40 mt-1">{t("welcome")} — {t("menu")}</p>
        </div>

        {/* Languages */}
        {tab === "languages" && (
          <>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">National Languages</p>
              <div className="space-y-2">
                {nationalLangs.map(lang => (
                  <button key={lang.id} onClick={() => selectLanguage(lang.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      language === lang.id ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 bg-white/5"
                    }`}
                    aria-pressed={language === lang.id}>
                    <span className="text-2xl">{lang.flag}</span>
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{lang.label}</p>
                      <p className="text-sm text-white/50">{lang.native}</p>
                    </div>
                    {language === lang.id && <CheckCircle className="h-5 w-5 text-indigo-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Regional Languages</p>
              <div className="grid grid-cols-2 gap-2">
                {regionalLangs.map(lang => (
                  <button key={lang.id} onClick={() => selectLanguage(lang.id)}
                    className={`p-3 rounded-xl border text-left ${
                      language === lang.id ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/10 bg-white/5"
                    }`}
                    aria-pressed={language === lang.id}>
                    <span className="text-lg">{lang.flag}</span>
                    <p className="text-xs font-semibold mt-1">{lang.native}</p>
                    <p className="text-[10px] text-white/40">{lang.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-sm font-semibold mb-2">Live preview</p>
              <div className="space-y-1 text-sm text-white/70">
                <p>{t("search")}</p>
                <p>{t("addToOrder")} · {t("cart")}</p>
                <p>{t("forYou")} · {t("allMenus")}</p>
              </div>
            </div>
          </>
        )}

        {/* Accessibility */}
        {tab === "accessibility" && (
          <>
            <p className="text-sm text-white/50">4 accessibility features for inclusive dining</p>
            <div className="space-y-3">
              {ACCESSIBILITY_FEATURES.map(f => {
                const key = A11Y_KEYS[f.id];
                const enabled = accessibility[key];
                const Icon = A11Y_ICONS[f.id];
                return (
                  <button key={f.id} onClick={() => toggleFeature(f.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left ${
                      enabled ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/10 bg-white/5"
                    }`}
                    aria-pressed={enabled}>
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl ${enabled ? "bg-indigo-500/20" : "bg-white/5"}`}>
                      {f.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold flex items-center gap-2">
                        <Icon className="h-4 w-4 text-indigo-400" /> {f.label}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">{f.desc}</p>
                    </div>
                    <div className={`w-11 h-6 rounded-full relative transition-all ${enabled ? "bg-indigo-500" : "bg-white/20"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-5" : "left-0.5"}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={`rounded-xl border p-4 ${accessibility.highContrast ? "border-yellow-400 bg-black text-yellow-100" : "border-white/10 bg-white/5"}`}>
              <p className={`font-semibold ${accessibility.largeText ? "text-lg" : "text-sm"}`}>
                Accessibility preview
              </p>
              <p className={`text-white/60 mt-1 ${accessibility.largeText ? "text-base" : "text-xs"}`}>
                Menu items, prices, and buttons scale when large text and high contrast are enabled.
              </p>
            </div>
          </>
        )}

        {/* Voice Menu */}
        {tab === "voice" && (
          <>
            {voiceLoading && <GuestLoading label="Loading voice menu…" />}
            {!voiceLoading && voiceError && (
              <GuestError message={voiceError} onRetry={loadVoiceMenu} />
            )}
            {!voiceLoading && !voiceError && (
            <>
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/25 p-4">
              <p className="text-sm font-semibold text-violet-200">{t("voiceMenu")}</p>
              <p className="text-xs text-white/50 mt-1">
                Enable voice menu in Accessibility tab, then tap 🔊 on any dish. Or play the full menu below.
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={playVoiceMenu} disabled={speaking}
                className="flex-1 py-3 rounded-xl bg-violet-600 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                <Play className="h-4 w-4" /> Play Menu ({language.toUpperCase()})
              </button>
              {speaking && (
                <button onClick={stopVoice} className="px-4 py-3 rounded-xl bg-white/10 border border-white/10">
                  <Square className="h-4 w-4" />
                </button>
              )}
            </div>

            {voiceScript && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-white/40 mb-2">Voice script</p>
                <pre className="text-xs text-white/70 whitespace-pre-wrap font-sans">{voiceScript}</pre>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-semibold">Try individual items</p>
              {voiceItems.length === 0 ? (
                <GuestEmpty message="No menu items for voice playback." />
              ) : voiceItems.map(item => (
                <button key={item.name}
                  onClick={() => speak(`${language === "hi" && item.nameHi ? item.nameHi : item.name}. ${t("price")} ${item.price} rupees`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-violet-500/30">
                  <span>{language === "hi" && item.nameHi ? item.nameHi : item.name}</span>
                  <span className="flex items-center gap-2 text-orange-400 text-sm">
                    ₹{item.price} <Volume2 className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
            </>
            )}
          </>
        )}
      </div>

      <div className="guest-bottom-bar">
        <button onClick={() => navigate("/user/menu")} className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold">
          {t("menu")} — {LANGUAGES.find(l => l.id === language)?.native}
        </button>
      </div>
    </div>
  );
}
