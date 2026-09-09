export type Therapist = { id: string; name: string; specialty?: string; rating?: number };
export type MembershipPlan = { id: string; label: string; price: number; period?: string; sessions?: number };

/**
 * Five named therapists with 4.7–4.9 star ratings, and three membership tiers at
 * ₹4,999 / ₹8,999 / ₹14,999, used to be served to every venue on the platform as though
 * they were its own. Nobody at any venue set them; the chosen therapist's name was written
 * into `spa_bookings.therapist`, and a ₹14,999 membership booked itself as PAID and flowed
 * into the owner's revenue as money that had never been collected.
 *
 * A venue's therapists and plans now come only from what it has published in its own
 * settings (`spaCatalog`). These lists are empty, so a venue that has published nothing
 * offers nothing rather than offering someone else's price list.
 */
export const THERAPISTS: Therapist[] = [];

export const MEMBERSHIP_PLANS: MembershipPlan[] = [];

/** What this venue actually offers, from its own published catalog. */
export function therapistsFor(overrides?: { therapists?: unknown }): Therapist[] {
  return Array.isArray(overrides?.therapists) ? overrides!.therapists as Therapist[] : THERAPISTS;
}

export function membershipPlansFor(overrides?: { membershipPlans?: unknown }): MembershipPlan[] {
  const plans = Array.isArray(overrides?.membershipPlans) ? overrides!.membershipPlans as MembershipPlan[] : MEMBERSHIP_PLANS;
  // A plan with no price is not a plan a guest can be charged for.
  return plans.filter(p => p && typeof p.id === "string" && Number.isFinite(Number(p.price)) && Number(p.price) > 0);
}

export const SLOT_TIMES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
  "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
];

export function formatSlotLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${p}`;
}

export function computeAvailableSlots(
  date: string,
  duration: number,
  existingBookings: { scheduledAt: Date; duration: number; therapist: string | null }[],
  therapistId?: string,
) {
  return SLOT_TIMES.map(time => {
    const slotStart = new Date(`${date}T${time}:00`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);
    const conflict = existingBookings.some(b => {
      if (therapistId && therapistId !== "any" && b.therapist && b.therapist !== therapistId) return false;
      const bStart = new Date(b.scheduledAt);
      const bEnd = new Date(bStart.getTime() + (b.duration || 60) * 60000);
      return slotStart < bEnd && slotEnd > bStart;
    });
    return { time, label: formatSlotLabel(time), available: !conflict && slotStart > new Date() };
  });
}

export function getCatalog(overrides?: { therapists?: unknown; membershipPlans?: unknown }) {
  return {
    therapists: therapistsFor(overrides),
    membershipPlans: membershipPlansFor(overrides),
    wellnessTypes: [
      { id: "yoga", label: "Yoga Sessions", icon: "🧘" },
      { id: "gym", label: "Gym Sessions", icon: "🏋️" },
      { id: "meditation", label: "Meditation Sessions", icon: "🕉️" },
      { id: "wellness", label: "Wellness Therapy", icon: "🌿" },
    ],
    slotTimes: SLOT_TIMES,
  };
}

export function couplePrice(basePrice: number): number {
  return Math.round(basePrice * 1.85);
}
