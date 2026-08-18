const LANGUAGES = [
  { id: "en", label: "English", native: "English", region: "National" },
  { id: "hi", label: "Hindi", native: "हिन्दी", region: "National" },
  { id: "ta", label: "Tamil", native: "தமிழ்", region: "Regional" },
  { id: "te", label: "Telugu", native: "తెలుగు", region: "Regional" },
  { id: "bn", label: "Bengali", native: "বাংলা", region: "Regional" },
  { id: "mr", label: "Marathi", native: "मराठी", region: "Regional" },
  { id: "gu", label: "Gujarati", native: "ગુજરાતી", region: "Regional" },
  { id: "kn", label: "Kannada", native: "ಕನ್ನಡ", region: "Regional" },
  { id: "ml", label: "Malayalam", native: "മലയാളം", region: "Regional" },
  { id: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ", region: "Regional" },
];

const ACCESSIBILITY = [
  "voice_menu", "large_text", "high_contrast", "screen_reader",
];

const UI_EN: Record<string, string> = {
  menu: "Menu", search: "Search dishes, beverages…", cart: "Cart", addToOrder: "Add to Order",
  orderNow: "Order Now", support: "Support", language: "Language", accessibility: "Accessibility",
  voiceMenu: "Voice Menu", largeText: "Large Text", highContrast: "High Contrast",
  screenReader: "Screen Reader", welcome: "Welcome", table: "Table", price: "Price",
  vegetarian: "Vegetarian", nonVeg: "Non-Veg", allMenus: "All Menus", forYou: "For You",
};

const UI_HI: Record<string, string> = {
  menu: "मेन्यू", search: "व्यंजन, पेय खोजें…", cart: "कार्ट", addToOrder: "ऑर्डर में जोड़ें",
  orderNow: "अभी ऑर्डर करें", support: "सहायता", language: "भाषा", accessibility: "सुगम्यता",
  voiceMenu: "वॉयस मेन्यू", largeText: "बड़ा टेक्स्ट", highContrast: "उच्च कंट्रास्ट",
  screenReader: "स्क्रीन रीडर", welcome: "स्वागत है", table: "टेबल", price: "कीमत",
  vegetarian: "शाकाहारी", nonVeg: "मांसाहारी", allMenus: "सभी मेन्यू", forYou: "आपके लिए",
};

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: UI_EN,
  hi: UI_HI,
  ta: { ...UI_EN, menu: "மெனு", welcome: "வரவேற்கிறோம்", cart: "கூடை" },
  te: { ...UI_EN, menu: "మెనూ", welcome: "స్వాగతం", cart: "కార్ట్" },
  bn: { ...UI_EN, menu: "মেনু", welcome: "স্বাগতম", cart: "কার্ট" },
  mr: { ...UI_EN, menu: "मेनू", welcome: "स्वागत", cart: "कार्ट" },
  gu: { ...UI_EN, menu: "મેનુ", welcome: "સ્વાગત", cart: "કાર્ટ" },
  kn: { ...UI_EN, menu: "ಮೆನು", welcome: "ಸ್ವಾಗತ", cart: "ಕಾರ್ಟ್" },
  ml: { ...UI_EN, menu: "മെനു", welcome: "സ്വാഗതം", cart: "കാർട്ട്" },
  pa: { ...UI_EN, menu: "ਮੇਨੂ", welcome: "ਜੀ ਆਇਆਂ ਨੂੰ", cart: "ਕਾਰਟ" },
};

const VOICE_LANG_MAP: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN",
  mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN",
};

export type AccessibilitySettings = {
  voiceMenu: boolean;
  largeText: boolean;
  highContrast: boolean;
  screenReader: boolean;
};

export function getLocaleCatalog() {
  return {
    languages: LANGUAGES,
    accessibilityFeatures: ACCESSIBILITY,
    defaultLanguage: "en",
    voiceLanguages: Object.keys(VOICE_LANG_MAP),
  };
}

export function getTranslations(lang: string) {
  const id = TRANSLATIONS[lang] ? lang : "en";
  return { language: id, strings: TRANSLATIONS[id] ?? UI_EN };
}

export function translate(lang: string, key: string): string {
  const strings = TRANSLATIONS[lang] ?? UI_EN;
  return strings[key] ?? UI_EN[key] ?? key;
}

export function buildVoiceMenuScript(
  items: { name: string; price: number; description?: string }[],
  lang: string,
) {
  const t = (k: string) => translate(lang, k);
  const lines = items.map((item, i) => {
    const desc = item.description ? `. ${item.description}` : "";
    return `${i + 1}. ${item.name}. ${t("price")} ${item.price} rupees${desc}`;
  });
  return {
    language: VOICE_LANG_MAP[lang] ?? "en-IN",
    script: lines.join("\n"),
    itemCount: items.length,
  };
}

export function normalizeAccessibility(raw: unknown): AccessibilitySettings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    voiceMenu: Boolean(r.voiceMenu),
    largeText: Boolean(r.largeText),
    highContrast: Boolean(r.highContrast),
    screenReader: Boolean(r.screenReader),
  };
}

export function mergeDeviceAccessibility(
  deviceInfo: unknown,
  patch: Partial<AccessibilitySettings>,
): Record<string, unknown> {
  const base = (typeof deviceInfo === "object" && deviceInfo !== null ? deviceInfo : {}) as Record<string, unknown>;
  const current = normalizeAccessibility(base.accessibility);
  return {
    ...base,
    accessibility: { ...current, ...patch },
  };
}

export function getSpeechLocale(lang: string): string {
  return VOICE_LANG_MAP[lang] ?? "en-IN";
}
