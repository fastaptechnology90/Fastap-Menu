/** Smart Dining Experience — table interaction catalog */
export const TABLE_INTERACTION_REQUESTS = [
  { id: "call_waiter", label: "Call Waiter", icon: "🙋", type: "call_waiter" },
  { id: "water", label: "Request Water", icon: "💧", type: "request_water" },
  { id: "tissue", label: "Request Tissue", icon: "🧻", type: "request_tissue" },
  { id: "cutlery", label: "Request Spoon/Fork", icon: "🍴", type: "request_cutlery" },
  { id: "menu", label: "Request Menu", icon: "📋", type: "request_menu" },
  { id: "cleaning", label: "Request Cleaning", icon: "🧹", type: "request_cleaning" },
  { id: "ac", label: "Request AC Adjustment", icon: "❄️", type: "request_ac" },
  { id: "music", label: "Request Music Adjustment", icon: "🎵", type: "request_music" },
  { id: "assistance", label: "Request Assistance", icon: "💡", type: "request_assistance" },
] as const;

export type BillMode = "live" | "seat_wise" | "shared" | "split" | "item_wise" | "group";

export const BILL_MODES = [
  { id: "live" as const, label: "Live Running Bill", icon: "📊", desc: "Real-time total as you order" },
  { id: "seat_wise" as const, label: "Seat-wise Billing", icon: "🪑", desc: "Assign items to each seat" },
  { id: "shared" as const, label: "Shared Billing", icon: "🤝", desc: "One combined bill for the table" },
  { id: "split" as const, label: "Split Billing", icon: "➗", desc: "Divide equally among guests" },
  { id: "item_wise" as const, label: "Item-wise Payment", icon: "☑️", desc: "Pay only for your items" },
  { id: "group" as const, label: "Group Payment", icon: "👥", desc: "One person pays for everyone" },
];

export interface RunningBillLine {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  seat: number;
  paid: boolean;
  source: "cart" | "order";
  orderId?: string;
}

export interface DiningBillConfig {
  mode: BillMode;
  seatCount: number;
  seatAssignments: Record<string, number>;
  paidItemIds: string[];
  groupPayerName: string;
  splitCount: number;
}

export const DEFAULT_BILL_CONFIG: DiningBillConfig = {
  mode: "live",
  seatCount: 2,
  seatAssignments: {},
  paidItemIds: [],
  groupPayerName: "",
  splitCount: 2,
};

export function lineTotal(price: number, qty: number, addons: { price: number }[] = []) {
  return (price + addons.reduce((s, a) => s + a.price, 0)) * qty;
}

export function computeBillSummary(lines: RunningBillLine[], config: DiningBillConfig) {
  const unpaid = lines.filter(l => !l.paid);
  const subtotal = unpaid.reduce((s, l) => s + l.lineTotal, 0);
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + gst;
  const paidTotal = lines.filter(l => l.paid).reduce((s, l) => s + l.lineTotal, 0);

  const seatTotals: Record<number, number> = {};
  for (const line of unpaid) {
    const seat = line.seat || 1;
    seatTotals[seat] = (seatTotals[seat] ?? 0) + line.lineTotal;
  }

  const perPerson = config.mode === "split" && config.splitCount > 0
    ? Math.ceil(total / config.splitCount)
    : 0;

  return { subtotal, gst, total, paidTotal, seatTotals, perPerson, unpaidCount: unpaid.length };
}
