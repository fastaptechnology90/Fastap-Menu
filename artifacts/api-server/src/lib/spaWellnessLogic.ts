export const THERAPISTS = [
  { id: "priya", name: "Priya Sharma", specialty: "Swedish & Deep Tissue", rating: 4.9 },
  { id: "ahmed", name: "Ahmed Al-Rashid", specialty: "Sports & Thai Massage", rating: 4.8 },
  { id: "meera", name: "Meera Patel", specialty: "Facial & Aromatherapy", rating: 4.9 },
  { id: "raj", name: "Raj Kumar", specialty: "Ayurveda & Wellness", rating: 4.7 },
  { id: "sana", name: "Sana Khan", specialty: "Yoga & Meditation", rating: 4.9 },
];

export const MEMBERSHIP_PLANS = [
  { id: "silver", label: "Silver Wellness", price: 4999, period: "month", sessions: 4 },
  { id: "gold", label: "Gold Wellness", price: 8999, period: "month", sessions: 8 },
  { id: "platinum", label: "Platinum Wellness", price: 14999, period: "month", sessions: 12 },
];

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

export function getCatalog() {
  return {
    therapists: THERAPISTS,
    membershipPlans: MEMBERSHIP_PLANS,
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
