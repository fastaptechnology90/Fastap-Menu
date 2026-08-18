/** Multi Language & Accessibility — catalog, translations & demo data */

export type LanguageId =
  | "en" | "hi" | "ta" | "te" | "bn" | "mr" | "gu" | "kn" | "ml" | "pa";

export type AccessibilityFeatureId =
  | "voice_menu" | "large_text" | "high_contrast" | "screen_reader";

export const LANGUAGES = [
  { id: "en" as const, label: "English", native: "English", flag: "🇬🇧", region: "National" },
  { id: "hi" as const, label: "Hindi", native: "हिन्दी", flag: "🇮🇳", region: "National" },
  { id: "ta" as const, label: "Tamil", native: "தமிழ்", flag: "🇮🇳", region: "Regional" },
  { id: "te" as const, label: "Telugu", native: "తెలుగు", flag: "🇮🇳", region: "Regional" },
  { id: "bn" as const, label: "Bengali", native: "বাংলা", flag: "🇮🇳", region: "Regional" },
  { id: "mr" as const, label: "Marathi", native: "मराठी", flag: "🇮🇳", region: "Regional" },
  { id: "gu" as const, label: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳", region: "Regional" },
  { id: "kn" as const, label: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳", region: "Regional" },
  { id: "ml" as const, label: "Malayalam", native: "മലയാളം", flag: "🇮🇳", region: "Regional" },
  { id: "pa" as const, label: "Punjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳", region: "Regional" },
];

export const ACCESSIBILITY_FEATURES = [
  { id: "voice_menu" as const, label: "Voice Menu", icon: "🔊", desc: "Listen to dish names, prices & descriptions aloud" },
  { id: "large_text" as const, label: "Large Text Mode", icon: "🔤", desc: "Increase text size across the entire menu" },
  { id: "high_contrast" as const, label: "High Contrast Mode", icon: "◐", desc: "Bold colors & borders for low-vision users" },
  { id: "screen_reader" as const, label: "Screen Reader Support", icon: "♿", desc: "Enhanced ARIA labels & live announcements" },
];

export type AccessibilitySettings = {
  voiceMenu: boolean;
  largeText: boolean;
  highContrast: boolean;
  screenReader: boolean;
};

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  voiceMenu: false,
  largeText: false,
  highContrast: false,
  screenReader: false,
};

export const UI_STRING_KEYS = [
  "menu", "search", "cart", "addToOrder", "orderNow", "support", "language",
  "accessibility", "voiceMenu", "largeText", "highContrast", "screenReader",
  "welcome", "table", "price", "vegetarian", "nonVeg", "allMenus", "forYou",
] as const;

export type UiStringKey = typeof UI_STRING_KEYS[number];

export const TRANSLATIONS: Record<LanguageId, Record<UiStringKey, string>> = {
  en: {
    menu: "Menu", search: "Search dishes, beverages…", cart: "Cart", addToOrder: "Add to Order",
    orderNow: "Order Now", support: "Support", language: "Language", accessibility: "Accessibility",
    voiceMenu: "Voice Menu", largeText: "Large Text", highContrast: "High Contrast",
    screenReader: "Screen Reader", welcome: "Welcome", table: "Table", price: "Price",
    vegetarian: "Vegetarian", nonVeg: "Non-Veg", allMenus: "All Menus", forYou: "For You",
  },
  hi: {
    menu: "मेन्यू", search: "व्यंजन, पेय खोजें…", cart: "कार्ट", addToOrder: "ऑर्डर में जोड़ें",
    orderNow: "अभी ऑर्डर करें", support: "सहायता", language: "भाषा", accessibility: "सुगम्यता",
    voiceMenu: "वॉयस मेन्यू", largeText: "बड़ा टेक्स्ट", highContrast: "उच्च कंट्रास्ट",
    screenReader: "स्क्रीन रीडर", welcome: "स्वागत है", table: "टेबल", price: "कीमत",
    vegetarian: "शाकाहारी", nonVeg: "मांसाहारी", allMenus: "सभी मेन्यू", forYou: "आपके लिए",
  },
  ta: {
    menu: "மெனு", search: "உணவு, பானங்கள் தேடுங்கள்…", cart: "கூடை", addToOrder: "ஆர்டரில் சேர்",
    orderNow: "இப்போது ஆர்டர்", support: "ஆதரவு", language: "மொழி", accessibility: "அணுகல்",
    voiceMenu: "குரல் மெனு", largeText: "பெரிய எழுத்து", highContrast: "உயர் contrast",
    screenReader: "திரை வாசகர்", welcome: "வரவேற்கிறோம்", table: "மேசை", price: "விலை",
    vegetarian: "சைவம்", nonVeg: "அசைவம்", allMenus: "அனைத்து மெனு", forYou: "உங்களுக்கு",
  },
  te: {
    menu: "మెనూ", search: "వంటకాలు, పానీయాలు వెతకండి…", cart: "కార్ట్", addToOrder: "ఆర్డర్‌లో చేర్చు",
    orderNow: "ఇప్పుడు ఆర్డర్", support: "మద్దతు", language: "భాష", accessibility: "అందుబాటు",
    voiceMenu: "వాయిస్ మెనూ", largeText: "పెద్ద టెక్స్ట్", highContrast: "అధిక contrast",
    screenReader: "స్క్రీన్ రీడర్", welcome: "స్వాగతం", table: "టేబుల్", price: "ధర",
    vegetarian: "శాకాహారం", nonVeg: "మాంసాహారం", allMenus: "అన్ని మెనూలు", forYou: "మీ కోసం",
  },
  bn: {
    menu: "মেনু", search: "খাবার, পানীয় খুঁজুন…", cart: "কার্ট", addToOrder: "অর্ডারে যোগ",
    orderNow: "এখনই অর্ডার", support: "সহায়তা", language: "ভাষা", accessibility: "অ্যাক্সেসিবিলিটি",
    voiceMenu: "ভয়েস মেনু", largeText: "বড় টেক্সট", highContrast: "উচ্চ কনট্রাস্ট",
    screenReader: "স্ক্রিন রিডার", welcome: "স্বাগতম", table: "টেবিল", price: "দাম",
    vegetarian: "নিরামিষ", nonVeg: "আমিষ", allMenus: "সব মেনু", forYou: "আপনার জন্য",
  },
  mr: {
    menu: "मेनू", search: "पदार्थ, पेय शोधा…", cart: "कार्ट", addToOrder: "ऑर्डरमध्ये जोडा",
    orderNow: "आता ऑर्डर करा", support: "मदत", language: "भाषा", accessibility: "सुलभता",
    voiceMenu: "व्हॉइस मेनू", largeText: "मोठा मजकूर", highContrast: "उच्च कॉन्ट्रास्ट",
    screenReader: "स्क्रीन रीडर", welcome: "स्वागत", table: "टेबल", price: "किंमत",
    vegetarian: "शाकाहारी", nonVeg: "मांसाहारी", allMenus: "सर्व मेनू", forYou: "तुमच्यासाठी",
  },
  gu: {
    menu: "મેનુ", search: "વાનગીઓ, પીણાં શોધો…", cart: "કાર્ટ", addToOrder: "ઓર્ડરમાં ઉમેરો",
    orderNow: "હવે ઓર્ડર", support: "સહાય", language: "ભાષા", accessibility: "એક્સેસિબિલિટી",
    voiceMenu: "વોઇસ મેનુ", largeText: "મોટો ટેક્સ્ટ", highContrast: "ઉચ્ચ કોન્ટ્રાસ્ટ",
    screenReader: "સ્ક્રીન રીડર", welcome: "સ્વાગત", table: "ટેબલ", price: "કિંમત",
    vegetarian: "શાકાહારી", nonVeg: "માંસાહારી", allMenus: "બધા મેનુ", forYou: "તમારા માટે",
  },
  kn: {
    menu: "ಮೆನು", search: "ಆಹಾರ, ಪಾನೀಯಗಳನ್ನು ಹುಡುಕಿ…", cart: "ಕಾರ್ಟ್", addToOrder: "ಆರ್ಡರ್‌ಗೆ ಸೇರಿಸಿ",
    orderNow: "ಈಗ ಆರ್ಡರ್", support: "ಬೆಂಬಲ", language: "ಭಾಷೆ", accessibility: "ಪ್ರವೇಶ",
    voiceMenu: "ವಾಯ್ಸ್ ಮೆನು", largeText: "ದೊಡ್ಡ ಪಠ್ಯ", highContrast: "ಹೆಚ್ಚಿನ ಕಾಂಟ್ರಾಸ್ಟ್",
    screenReader: "ಸ್ಕ್ರೀನ್ ರೀಡರ್", welcome: "ಸ್ವಾಗತ", table: "ಮೇಜು", price: "ಬೆಲೆ",
    vegetarian: "ಶಾಖಾಹಾರ", nonVeg: "ಮಾಂಸಾಹಾರ", allMenus: "ಎಲ್ಲಾ ಮೆನು", forYou: "ನಿಮಗಾಗಿ",
  },
  ml: {
    menu: "മെനു", search: "ഭക്ഷണം, പാനീയങ്ങൾ തിരയുക…", cart: "കാർട്ട്", addToOrder: "ഓർഡറിൽ ചേർക്കുക",
    orderNow: "ഇപ്പോൾ ഓർഡർ", support: "പിന്തുണ", language: "ഭാഷ", accessibility: "പ്രവേശനം",
    voiceMenu: "വോയ്സ് മെനു", largeText: "വലിയ ടെക്സ്റ്റ്", highContrast: "ഉയർന്ന കോൺട്രാസ്റ്റ്",
    screenReader: "സ്ക്രീൻ റീഡർ", welcome: "സ്വാഗതം", table: "ടേബിൾ", price: "വില",
    vegetarian: "സസ്യാഹാരം", nonVeg: "മാംസാഹാരം", allMenus: "എല്ലാ മെനു", forYou: "നിങ്ങൾക്കായി",
  },
  pa: {
    menu: "ਮੇਨੂ", search: "ਖਾਣ-ਪੀਣ ਖੋਜੋ…", cart: "ਕਾਰਟ", addToOrder: "ਆਰਡਰ ਵਿੱਚ ਜੋੜੋ",
    orderNow: "ਹੁਣੇ ਆਰਡਰ", support: "ਸਹਾਇਤਾ", language: "ਭਾਸ਼ਾ", accessibility: "ਪਹੁੰਚ",
    voiceMenu: "ਵੌਇਸ ਮੇਨੂ", largeText: "ਵੱਡਾ ਟੈਕਸਟ", highContrast: "ਉੱਚ ਕੰਟ੍ਰਾਸਟ",
    screenReader: "ਸਕ੍ਰੀਨ ਰੀਡਰ", welcome: "ਜੀ ਆਇਆਂ ਨੂੰ", table: "ਟੇਬਲ", price: "ਕੀਮਤ",
    vegetarian: "ਸ਼ਾਕਾਹਾਰੀ", nonVeg: "ਮਾਸਾਹਾਰੀ", allMenus: "ਸਾਰੇ ਮੇਨੂ", forYou: "ਤੁਹਾਡੇ ਲਈ",
  },
};

/** Sample menu item names in Hindi for voice demo */
export const DEMO_MENU_VOICE = [
  { name: "Butter Chicken", nameHi: "बटर चिकन", price: 65 },
  { name: "Paneer Tikka", nameHi: "पनीर टिक्का", price: 45 },
  { name: "Masala Dosa", nameHi: "मसाला डोसा", price: 35 },
];

export function languageLabel(id: LanguageId): string {
  return LANGUAGES.find(l => l.id === id)?.native ?? id;
}
