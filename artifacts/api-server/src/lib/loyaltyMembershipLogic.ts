export type MembershipTierId = "silver" | "gold" | "platinum" | "diamond" | "vip-elite";

export const MEMBERSHIP_TIERS = [
  { id: "silver" as const, label: "Silver", minPoints: 0, cashbackPercent: 5 },
  { id: "gold" as const, label: "Gold", minPoints: 500, cashbackPercent: 10 },
  { id: "platinum" as const, label: "Platinum", minPoints: 1000, cashbackPercent: 15 },
  { id: "diamond" as const, label: "Diamond", minPoints: 2500, cashbackPercent: 20 },
  { id: "vip-elite" as const, label: "VIP Elite", minPoints: 5000, cashbackPercent: 25 },
];

export const POINTS_REDEEM_RATE = 10;
export const BIRTHDAY_REWARD_VALUE = 500;
export const ANNIVERSARY_REWARD_VALUE = 750;

function parseNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? fallback));
  return Number.isNaN(n) ? fallback : n;
}

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

export function nextTierId(tierId: MembershipTierId): MembershipTierId | null {
  const idx = MEMBERSHIP_TIERS.findIndex(t => t.id === tierId);
  return idx >= 0 && idx < MEMBERSHIP_TIERS.length - 1 ? MEMBERSHIP_TIERS[idx + 1].id : null;
}

export function normalizeRewardsMeta(raw: unknown) {
  const m = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    diningCredits: parseNum(m.diningCredits),
    birthdayClaimedYear: (m.birthdayClaimedYear as number | null) ?? null,
    anniversaryClaimedYear: (m.anniversaryClaimedYear as number | null) ?? null,
  };
}

export function isBirthdayMonth(birthday?: string | null): boolean {
  if (!birthday) return false;
  const b = new Date(birthday);
  return b.getMonth() === new Date().getMonth();
}

export function isAnniversaryMonth(anniversary?: string | null): boolean {
  if (!anniversary) return false;
  const a = new Date(anniversary);
  return a.getMonth() === new Date().getMonth();
}

export function getLoyaltyCatalog() {
  return {
    tiers: MEMBERSHIP_TIERS,
    rewardTypes: ["cashback", "points", "dining_credits", "birthday", "anniversary"],
    pointsRedeemRate: POINTS_REDEEM_RATE,
    birthdayReward: BIRTHDAY_REWARD_VALUE,
    anniversaryReward: ANNIVERSARY_REWARD_VALUE,
  };
}

export function buildMemberSummary(
  guest: {
    loyaltyPoints?: string | null;
    birthday?: string | null;
    anniversary?: string | null;
    rewardsMeta?: unknown;
    cashbackBalance?: string | null;
    walletBuckets?: Record<string, string> | null;
  },
  customer?: { loyaltyPoints?: number; totalSpend?: string | number; birthday?: string | null; anniversary?: string | null } | null,
  program?: { cashbackPercent?: string | number; pointsPerDollar?: string | number } | null,
) {
  const points = Math.max(parseInt(guest.loyaltyPoints || "0", 10), customer?.loyaltyPoints ?? 0);
  const spend = parseNum(customer?.totalSpend);
  const tier = tierFromPoints(points, spend);
  const cfg = tierConfig(tier);
  const rewardsMeta = normalizeRewardsMeta(guest.rewardsMeta);
  const birthday = guest.birthday ?? customer?.birthday ?? null;
  const anniversary = guest.anniversary ?? customer?.anniversary ?? null;
  const year = new Date().getFullYear();

  const cashbackBalance = parseNum(guest.walletBuckets?.cashback ?? guest.cashbackBalance);

  return {
    points,
    tier,
    tierLabel: cfg.label,
    cashbackPercent: cfg.cashbackPercent,
    programCashback: parseNum(program?.cashbackPercent, cfg.cashbackPercent),
    diningCredits: rewardsMeta.diningCredits,
    cashbackBalance,
    birthday,
    anniversary,
    rewards: {
      cashback: { balance: cashbackBalance, rate: cfg.cashbackPercent, label: "Cashback Wallet" },
      points: { balance: points, redeemRate: POINTS_REDEEM_RATE, label: "Reward Points" },
      diningCredits: { balance: rewardsMeta.diningCredits, label: "Dining Credits" },
      birthday: {
        eligible: isBirthdayMonth(birthday) && rewardsMeta.birthdayClaimedYear !== year,
        value: BIRTHDAY_REWARD_VALUE,
        claimed: rewardsMeta.birthdayClaimedYear === year,
        birthday,
      },
      anniversary: {
        eligible: isAnniversaryMonth(anniversary) && rewardsMeta.anniversaryClaimedYear !== year,
        value: ANNIVERSARY_REWARD_VALUE,
        claimed: rewardsMeta.anniversaryClaimedYear === year,
        anniversary,
      },
    },
    progress: (() => {
      const next = nextTierId(tier);
      if (!next) return { percent: 100, remaining: 0, nextTier: null };
      const nextMin = tierConfig(next).minPoints;
      const currentMin = cfg.minPoints;
      const range = nextMin - currentMin;
      return {
        percent: Math.min(100, Math.round(((points - currentMin) / range) * 100)),
        remaining: Math.max(0, nextMin - points),
        nextTier: tierConfig(next).label,
      };
    })(),
  };
}

export function applyPointsRedeem(
  points: number,
  redeemPoints: number,
  rewardsMeta: ReturnType<typeof normalizeRewardsMeta>,
) {
  if (redeemPoints <= 0 || redeemPoints > points) return null;
  const credit = Math.floor(redeemPoints / POINTS_REDEEM_RATE);
  if (credit <= 0) return null;
  return {
    newPoints: points - redeemPoints,
    newRewardsMeta: { ...rewardsMeta, diningCredits: rewardsMeta.diningCredits + credit },
    creditAdded: credit,
  };
}

export function applyBirthdayClaim(rewardsMeta: ReturnType<typeof normalizeRewardsMeta>, year: number) {
  return {
    ...rewardsMeta,
    diningCredits: rewardsMeta.diningCredits + BIRTHDAY_REWARD_VALUE,
    birthdayClaimedYear: year,
  };
}

export function applyAnniversaryClaim(rewardsMeta: ReturnType<typeof normalizeRewardsMeta>, year: number) {
  return {
    ...rewardsMeta,
    diningCredits: rewardsMeta.diningCredits + ANNIVERSARY_REWARD_VALUE,
    anniversaryClaimedYear: year,
  };
}
