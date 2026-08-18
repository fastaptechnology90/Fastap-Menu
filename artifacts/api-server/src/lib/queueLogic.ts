import type { QueueEntry } from "@workspace/db";

export const QUEUE_PRIORITIES = ["vip", "corporate", "membership", "family", "normal"] as const;
export type QueuePriorityId = (typeof QUEUE_PRIORITIES)[number];

export const MEMBERSHIP_TIERS = ["silver", "gold", "platinum", "diamond", "vip-elite"] as const;

const PRIORITY_WEIGHTS: Record<string, number> = {
  vip: 100,
  corporate: 85,
  membership_vip_elite: 95,
  membership_diamond: 80,
  membership_platinum: 70,
  membership_gold: 60,
  membership_silver: 50,
  membership: 55,
  family: 45,
  normal: 0,
};

const AVG_TURN_MINUTES = 12;
export function resolvePriority(input: {
  priority?: string;
  queueType?: string;
  membershipTier?: string;
  corporateCode?: string;
  partySize?: number;
  validCorporateCodes?: string[];
}): string {
  if (input.priority === "vip" || input.queueType === "vip") return "vip";
  const code = input.corporateCode?.trim().toUpperCase();
  const allowed = new Set((input.validCorporateCodes ?? []).map(c => c.toUpperCase()));
  if (code && allowed.has(code)) return "corporate";
  if (input.membershipTier && input.membershipTier !== "silver") {
    return `membership_${input.membershipTier.replace("-", "_")}`;
  }
  if (input.priority?.startsWith("membership") || input.queueType === "membership") {
    return input.priority?.startsWith("membership") ? input.priority : "membership_gold";
  }
  if (input.priority === "family" || input.queueType === "family" || (input.partySize ?? 0) >= 5) {
    return "family";
  }
  return "normal";
}

export function priorityWeight(priority: string | null | undefined): number {
  if (!priority) return 0;
  return PRIORITY_WEIGHTS[priority] ?? PRIORITY_WEIGHTS[priority.replace("-", "_")] ?? 0;
}

export function sortWaitingQueue(entries: QueueEntry[]): QueueEntry[] {
  return [...entries].sort((a, b) => {
    const w = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (w !== 0) return w;
    return a.tokenNumber - b.tokenNumber;
  });
}

export function computePosition(sorted: QueueEntry[], entryId: number): number {
  const idx = sorted.findIndex(e => e.id === entryId);
  return idx >= 0 ? idx + 1 : sorted.length + 1;
}

export function predictWaitTime(
  position: number,
  partySize: number,
  freeTables: number,
  queueLength: number,
): { estimatedWait: number; groupsAhead: number; freeTablesSoon: number; predictionLabel: string } {
  const groupsAhead = Math.max(0, position - 1);
  const freeTablesSoon = Math.min(4, Math.max(freeTables, Math.ceil(queueLength / 4)));

  if (freeTables > 0 && groupsAhead === 0) {
    return { estimatedWait: 0, groupsAhead: 0, freeTablesSoon, predictionLabel: "Table available now" };
  }

  const tableThroughput = Math.max(1, freeTables + freeTablesSoon);
  const batches = Math.ceil(groupsAhead / tableThroughput);
  let estimatedWait = batches * AVG_TURN_MINUTES;
  if (partySize > 6) estimatedWait += 10;
  else if (partySize > 4) estimatedWait += 5;
  estimatedWait = Math.max(5, Math.min(90, estimatedWait));

  const predictionLabel =
    estimatedWait <= 10 ? "Short wait expected" :
    estimatedWait <= 25 ? "Moderate wait" :
    "Peak hour — longer wait";

  return { estimatedWait, groupsAhead, freeTablesSoon, predictionLabel };
}

export function formatTokenNumber(n: number): string {
  return `#${String(n).padStart(2, "0")}`;
}

export function anonymizeWaitlistEntry(entry: QueueEntry, position: number) {
  return {
    tokenNumber: entry.tokenNumber,
    displayToken: formatTokenNumber(entry.tokenNumber),
    partySize: entry.partySize,
    priority: entry.priority ?? "normal",
    queueType: entry.queueType ?? "dining",
    estimatedWait: entry.estimatedWait,
    status: entry.status,
    position,
    label: `Guest ${formatTokenNumber(entry.tokenNumber)}`,
  };
}

export async function logQueueAlert(
  db: { insert: (table: unknown) => { values: (v: unknown) => { catch: (fn: () => void) => Promise<void> } } },
  notificationsLogTable: unknown,
  restaurantId: number,
  channel: string,
  phone: string | null | undefined,
  title: string,
  message: string,
  metadata: Record<string, unknown>,
) {
  if (channel === "app") return;
  await db.insert(notificationsLogTable).values({
    restaurantId,
    type: channel,
    title,
    message,
    recipient: phone ?? undefined,
    recipientType: "customer",
    status: "sent",
    metadata,
  }).catch(() => {});
}

export function buildJoinAlertMessage(tokenNumber: number, position: number, estimatedWait: number) {
  const token = formatTokenNumber(tokenNumber);
  const ord = position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th";
  return `You're ${position}${ord} in line. Token ${token}. Est. wait ~${estimatedWait} min.`;
}

export function buildReadyAlertMessage(tokenNumber: number) {
  return `Your table is ready! Token ${formatTokenNumber(tokenNumber)}. Please proceed to the host desk.`;
}
