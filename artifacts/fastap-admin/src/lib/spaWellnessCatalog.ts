/** Spa & Wellness System — guest catalog */
export const SPA_CATEGORIES = [
  { id: "massage", label: "Massage", icon: "💆" },
  { id: "facial", label: "Facial", icon: "✨" },
  { id: "body", label: "Body Treatment", icon: "🧴" },
  { id: "couple", label: "Couple Spa", icon: "💑" },
] as const;

export const WELLNESS_SERVICES = [
  { id: "yoga", label: "Yoga Sessions", icon: "🧘", desc: "Guided yoga for all levels", category: "yoga" },
  { id: "gym", label: "Gym Sessions", icon: "🏋️", desc: "Personal trainer & equipment access", category: "gym" },
  { id: "meditation", label: "Meditation Sessions", icon: "🕉️", desc: "Mindfulness & breathing workshops", category: "meditation" },
  { id: "wellness_therapy", label: "Wellness Therapy", icon: "🌿", desc: "Holistic therapy & Ayurveda", category: "wellness" },
] as const;

export const THERAPISTS = [
  { id: "priya", name: "Priya Sharma", specialty: "Swedish & Deep Tissue", rating: 4.9, avatar: "👩‍⚕️" },
  { id: "ahmed", name: "Ahmed Al-Rashid", specialty: "Sports & Thai Massage", rating: 4.8, avatar: "👨‍⚕️" },
  { id: "meera", name: "Meera Patel", specialty: "Facial & Aromatherapy", rating: 4.9, avatar: "👩‍⚕️" },
  { id: "raj", name: "Raj Kumar", specialty: "Ayurveda & Wellness", rating: 4.7, avatar: "👨‍⚕️" },
  { id: "sana", name: "Sana Khan", specialty: "Yoga & Meditation", rating: 4.9, avatar: "🧘" },
  { id: "any", name: "Any Available", specialty: "Best available therapist", rating: 4.5, avatar: "⭐" },
] as const;

export const MEMBERSHIP_PLANS = [
  { id: "silver", label: "Silver Wellness", icon: "🥈", price: 4999, period: "month", sessions: 4, perks: ["4 spa sessions/mo", "10% off add-ons", "Priority booking"] },
  { id: "gold", label: "Gold Wellness", icon: "🥇", price: 8999, period: "month", sessions: 8, perks: ["8 sessions/mo", "Couple session included", "Free yoga classes", "20% off"] },
  { id: "platinum", label: "Platinum Wellness", icon: "💎", price: 14999, period: "month", sessions: 12, perks: ["Unlimited yoga & gym", "12 spa sessions", "Personal therapist", "30% off"] },
] as const;

export const SLOT_TIMES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
  "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
];

export interface SpaSlot {
  time: string;
  label: string;
  available: boolean;
}

export function formatSlotLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${p}`;
}

export const DEMO_SPA_SERVICES = [
  { id: 1, name: "Swedish Massage", category: "massage", duration: 60, price: 2500, description: "Classic relaxation massage" },
  { id: 2, name: "Deep Tissue Massage", category: "massage", duration: 60, price: 2800, description: "Targeted muscle relief" },
  { id: 3, name: "Aromatherapy Facial", category: "facial", duration: 45, price: 1800, description: "Rejuvenating facial treatment" },
  { id: 4, name: "Couple Spa Retreat", category: "couple", duration: 90, price: 5500, description: "Side-by-side massage for two", isCouple: true },
  { id: 5, name: "Hot Stone Therapy", category: "body", duration: 75, price: 3200, description: "Heated stone body treatment" },
];

export const DEMO_WELLNESS_SERVICES = [
  { id: 101, name: "Morning Yoga Flow", category: "yoga", duration: 60, price: 800, description: "Vinyasa flow for all levels" },
  { id: 102, name: "Sunset Yoga", category: "yoga", duration: 45, price: 600, description: "Relaxing evening session" },
  { id: 103, name: "Personal Gym Session", category: "gym", duration: 60, price: 1200, description: "1-on-1 trainer session" },
  { id: 104, name: "Group Gym Access", category: "gym", duration: 90, price: 500, description: "Full gym floor access" },
  { id: 105, name: "Guided Meditation", category: "meditation", duration: 45, price: 500, description: "Mindfulness & breathwork" },
  { id: 106, name: "Sound Bath Meditation", category: "meditation", duration: 60, price: 900, description: "Healing sound therapy" },
  { id: 107, name: "Ayurvedic Wellness", category: "wellness", duration: 90, price: 3500, description: "Traditional Ayurveda consultation + therapy" },
  { id: 108, name: "Reflexology Therapy", category: "wellness", duration: 45, price: 1500, description: "Foot & pressure point therapy" },
];
