/** Loyalty & Membership System — catalog */
export type MembershipTierId = "silver" | "gold" | "platinum" | "diamond" | "vip-elite";

export const MEMBERSHIP_TIERS = [
  { id: "silver" as const, label: "Silver", icon: "🥈", minPoints: 0, cashbackPercent: 5, color: "from-slate-400 to-slate-300", perks: ["5% cashback", "Birthday reward", "Priority queue"] },
  { id: "gold" as const, label: "Gold", icon: "🥇", minPoints: 500, cashbackPercent: 10, color: "from-yellow-500 to-amber-400", perks: ["10% cashback", "Monthly dining credit", "VIP seating", "Free delivery"] },
  { id: "platinum" as const, label: "Platinum", icon: "💎", minPoints: 1000, cashbackPercent: 15, color: "from-violet-400 to-purple-300", perks: ["15% cashback", "Chef's table access", "Concierge service", "Anniversary reward"] },
  { id: "diamond" as const, label: "Diamond", icon: "💠", minPoints: 2500, cashbackPercent: 20, color: "from-cyan-400 to-blue-400", perks: ["20% cashback", "Private dining", "Personal chef", "Double points weekends"] },
  { id: "vip-elite" as const, label: "VIP Elite", icon: "👑", minPoints: 5000, cashbackPercent: 25, color: "from-orange-400 to-rose-400", perks: ["25% cashback", "Dedicated manager", "Complimentary stays", "All rewards unlocked"] },
];

export const REWARD_TYPES = [
  { id: "cashback", label: "Cashback", icon: "💰", desc: "Earn % back on every order — credited to cashback wallet" },
  { id: "points", label: "Reward Points", icon: "⭐", desc: "Collect points and redeem for dining credits" },
  { id: "dining_credits", label: "Dining Credits", icon: "🍽️", desc: "Pre-loaded credits for food & beverages" },
  { id: "birthday", label: "Birthday Rewards", icon: "🎂", desc: "Special treat on your birthday month" },
  { id: "anniversary", label: "Anniversary Rewards", icon: "💑", desc: "Celebration reward on your anniversary" },
];

export const POINTS_REDEEM_RATE = 10; // 10 points = ₹1 dining credit
export const BIRTHDAY_REWARD_VALUE = 500;
export const ANNIVERSARY_REWARD_VALUE = 750;

export const DEMO_LOYALTY = {
  tier: "gold" as MembershipTierId,
  points: 1240,
  cashbackBalance: 120,
  diningCredits: 350,
  totalEarnedCashback: 680,
  birthday: "1990-06-15",
  anniversary: "2018-03-22",
  birthdayEligible: true,
  anniversaryEligible: false,
  transactions: [
    { id: 1, type: "earn", points: 118, cashback: 59, description: "Order #1234 — 10% Gold cashback", createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 2, type: "redeem", points: -200, description: "Redeemed 200 pts → ₹20 dining credit", createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 3, type: "birthday", points: 0, cashback: 0, description: "Birthday reward — ₹500 dining credit", createdAt: new Date(Date.now() - 30 * 86400000).toISOString() },
    { id: 4, type: "anniversary", points: 0, description: "Anniversary reward — ₹750 credit + dessert", createdAt: new Date(Date.now() - 365 * 86400000).toISOString() },
    { id: 5, type: "earn", points: 46, cashback: 23, description: "Order #1230 — points earned", createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  ],
};

export function tierFromPoints(points: number, spend = 0): MembershipTierId {
  if (points >= 5000 || spend >= 50000) return "vip-elite";
  if (points >= 2500 || spend >= 25000) return "diamond";
  if (points >= 1000 || spend >= 10000) return "platinum";
  if (points >= 500 || spend >= 5000) return "gold";
  return "silver";
}

export function tierConfig(tierId: MembershipTierId) {
  return MEMBERSHIP_TIERS.find(t => t.id === tierId) ?? MEMBERSHIP_TIERS[0];
}

export function nextTier(tierId: MembershipTierId): MembershipTierId | null {
  const idx = MEMBERSHIP_TIERS.findIndex(t => t.id === tierId);
  return idx >= 0 && idx < MEMBERSHIP_TIERS.length - 1 ? MEMBERSHIP_TIERS[idx + 1].id : null;
}

export function progressToNextTier(points: number, tierId: MembershipTierId) {
  const next = nextTier(tierId);
  if (!next) return { percent: 100, remaining: 0, nextTier: null };
  const nextCfg = tierConfig(next);
  const currentMin = tierConfig(tierId).minPoints;
  const range = nextCfg.minPoints - currentMin;
  const progress = points - currentMin;
  return {
    percent: Math.min(100, Math.round((progress / range) * 100)),
    remaining: Math.max(0, nextCfg.minPoints - points),
    nextTier: nextCfg.label,
  };
}

export function isBirthdayMonth(birthday?: string | null): boolean {
  if (!birthday) return false;
  const b = new Date(birthday);
  const now = new Date();
  return b.getMonth() === now.getMonth();
}

export function isAnniversaryMonth(anniversary?: string | null): boolean {
  if (!anniversary) return false;
  const a = new Date(anniversary);
  const now = new Date();
  return a.getMonth() === now.getMonth();
}

export function pointsToDiningCredit(points: number): number {
  return Math.floor(points / POINTS_REDEEM_RATE);
}
