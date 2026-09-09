import {
  AirVent, Armchair, ArrowLeftRight, BadgeCheck, BedDouble, Bell, BellRing, Bike, Building2,
  Baby, Banknote, Brush, Camera, Car, CheckSquare, ChefHat, Cloud, CloudRain, Copy, CreditCard,
  Crown, Dumbbell, Facebook, Flame, Flower, Flower2, Gem, Gift, GlassWater, Grid3x3, HandHeart,
  Hand, HandPlatter, Handshake, Heart, HelpCircle, Hospital, Hotel, Instagram, Landmark, Lamp,
  Laptop, Leaf, Lightbulb, Link2, ListChecks, Martini, MessageCircle, Monitor, Moon, Music2,
  Nfc, PartyPopper, Percent, PhoneCall, PieChart, Puzzle, QrCode, Receipt, RefreshCcw, Rows3,
  ScanLine, Scroll, Search, Share2, Shield, ShieldAlert, ShoppingBag, Smartphone, Snowflake,
  Sofa, Sparkles, SprayCan, Star, Store, Ticket, Timer, Trees, TrendingUp, Twitter, Type,
  Umbrella, UserRound, Users, Utensils, Video, Volume2, Waves, Wallet, Wand2, Wrench,
  Accessibility, Contrast, CalendarDays, Circle, Divide, MonitorSmartphone, Coins,
  Soup, IceCreamCone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * One lucide icon per catalog entry, keyed by the entry's own id.
 *
 * Every `lib/*Catalog.ts` carried an `icon: "🍽️"` field and thirteen guest screens
 * rendered it straight into the markup — 190 emoji across the panel. Emoji render
 * differently on every phone (and differently again between an Android launcher font and
 * a WebView), take no colour, do not scale with the type, and carry no accessible name.
 * On a chip row nine wide at 375px it is the single most visible tell that a screen was
 * not designed.
 *
 * The catalogs keep their `icon` field — the API echoes some of them back and nothing
 * else should have to change — but no guest screen reads it any more.
 */
const ICONS: Record<string, LucideIcon> = {
  // Reservation types and seating preferences
  table: Utensils, vip: Crown, hall: Landmark, banquet: PartyPopper, pool: Waves,
  spa: Flower2, cabana: Umbrella, conference: Building2,
  "indoor-ac": AirVent, outdoor: Trees, rooftop: Moon, private: Shield,
  poolside: Waves, "vip-lounge": Crown, "conference-room": Building2, "banquet-hall": Landmark,

  // Order types
  "dine-in": Utensils, takeaway: ShoppingBag, "drive-in": Car, "drive-through": Bike,
  "room-service": Hotel, bar: Martini, lounge: Sofa, event: PartyPopper,

  // Table-service requests and bill modes
  call_waiter: Hand, water: GlassWater, tissue: Scroll, cutlery: Utensils,
  menu: ListChecks, cleaning: Brush, ac: Snowflake, music: Music2, assistance: Lightbulb,
  live: TrendingUp, seat_wise: Armchair, shared: Handshake, split: Divide,
  item_wise: CheckSquare, group: Users,

  // Waitlist queue
  dining: Utensils, membership: Star, family: Users, corporate: Building2,
  app: Smartphone, sms: MessageCircle, whatsapp: MessageCircle, both: BellRing,

  // Support channels, ticket categories and emergencies
  live_chat: MessageCircle, voice: PhoneCall, ticket: Ticket, emergency: ShieldAlert,
  order: Receipt, payment: CreditCard, reservation: CalendarDays, food_quality: Star,
  staff: UserRound, technical: Laptop, other: HelpCircle,
  medical: Hospital, security: Shield, fire: Flame, food_safety: ShieldAlert,

  // Payment modes
  upi: Smartphone, card: CreditCard, cash: Banknote, nfc: Nfc, qr: QrCode,
  wallet: Wallet, netbanking: Landmark,

  // Wallet buckets
  main: Wallet, cashback: Coins, refund: RefreshCcw, reward: Gift, gift: Gift,

  // Spa and wellness
  massage: HandHeart, facial: Sparkles, body: SprayCan, couple: Heart, yoga: Flower,
  gym: Dumbbell, meditation: Lamp, wellness_therapy: Leaf,
  silver: Star, gold: BadgeCheck, platinum: Gem,

  // Kiosk
  self_ordering: Monitor, self_checkout: BadgeCheck, nfc_tap_ordering: Nfc,
  qr_self_payment: ScanLine, token_display: Ticket,

  // Social, reviews and sharing
  ratings: Star, reviews: MessageCircle, food_image_uploads: Camera,
  social_sharing: Link2, referral_sharing: Gift,
  overall: Star, food: Utensils, service: Bell, ambience: Sparkles,
  facebook: Facebook, twitter: Twitter, instagram: Instagram, copy: Copy, native: Share2,
  restaurant: Store, dish: ChefHat, review: Star, offer: Percent,

  // Digital experience
  live_offers: Flame, video_banners: Video, interactive_promotions: Puzzle,
  festival_themes: PartyPopper, seasonal_animations: Snowflake,
  default: Sparkles, diwali: Lamp, holi: Wand2, christmas: Trees, ramadan: Moon,
  monsoon: CloudRain, none: Circle, snow: Snowflake, petals: Flower,
  confetti: PartyPopper, fireflies: Sparkles, rain: CloudRain,

  // AI personalisation
  personalized_menu: Sparkles, favorite_prediction: Search, combo_recommendations: HandPlatter,
  ai_upselling: TrendingUp, dietary_suggestions: Leaf, spending_analysis: PieChart,

  // Language and accessibility
  voice_menu: Volume2, large_text: Type, high_contrast: Contrast, screen_reader: Accessibility,

  // Hotel room service
  laundry: Rows3, housekeeping: Sparkles, maintenance: Wrench, towel: Waves,
  toiletries: SprayCan, extra_bed: BedDouble, baby_crib: Baby, wake_up: Timer,

  // Cart line courses. Prefixed because "main" is also a wallet bucket.
  course_starter: Soup, course_main: Utensils, course_dessert: IceCreamCone, course_beverage: GlassWater,

  // Layout / misc
  theatre: Rows3, classroom: Grid3x3, u_shape: Grid3x3,
  transfer: ArrowLeftRight, devices: MonitorSmartphone, cloud: Cloud,
};

/** The icon for a catalog id, or a neutral dot when the catalog gains an entry. */
export function guestIconFor(id: string | undefined | null): LucideIcon {
  if (!id) return Circle;
  return ICONS[id] ?? ICONS[String(id).toLowerCase()] ?? Circle;
}

/**
 * Renders the icon for a catalog id. Decorative by default — the label always sits
 * beside it, so a second announcement of the same thing only slows a screen reader down.
 */
export function GuestIcon({
  id,
  className = "h-4 w-4",
  label,
}: {
  id: string | undefined | null;
  className?: string;
  label?: string;
}) {
  const Ico = guestIconFor(id);
  return <Ico className={className} aria-hidden={label ? undefined : true} aria-label={label} />;
}
