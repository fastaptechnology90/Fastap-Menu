/**
 * Hotel room folio (running bill) — WIP module.
 *
 * A room's folio is the single reception-side bill that sums every charge tied to that
 * room: the room rent (rate x nights, minus any check-in discount) plus each service
 * charge (food, bar, spa, minibar, laundry ...) stored in `roomServiceRequestsTable`.
 *
 * Food/bar charges ALSO mirror into `ordersTable` (type "room_service") so the kitchen
 * app and finance/revenue see them — but the folio reads ONLY the room-service requests,
 * so no view double-counts: reception reads requests, finance reads the mirror order,
 * both show the same amount.
 *
 * No schema change: room rate/discount live in `hotel_rooms.roomControls.billing`.
 */
import { and, eq } from "drizzle-orm";
import { db, hotelRoomsTable, roomServiceRequestsTable } from "@workspace/db";
import { parseMoney, roundMoney } from "./payment-calculations.js";

export type RoomBilling = { rate?: number; discount?: number; guestCount?: number; paid?: number };

/** Read the billing block we stash inside roomControls (no dedicated column). */
export function readRoomBilling(room: { roomControls?: unknown } | null | undefined): RoomBilling {
  const controls = (room?.roomControls ?? {}) as { billing?: RoomBilling };
  const b = controls.billing ?? {};
  return {
    rate: parseMoney(b.rate),
    discount: parseMoney(b.discount),
    guestCount: Number(b.guestCount) > 0 ? Number(b.guestCount) : 1,
    paid: parseMoney(b.paid),
  };
}

/** Merge a billing patch into an existing roomControls object (keeps device controls). */
export function mergeRoomBilling(existing: unknown, patch: RoomBilling): Record<string, unknown> {
  const controls = (existing ?? {}) as Record<string, unknown>;
  const current = (controls.billing ?? {}) as RoomBilling;
  return { ...controls, billing: { ...current, ...patch } };
}

export function nightsBetween(checkIn: Date | string | null | undefined, checkOut: Date | string | null | undefined): number {
  if (!checkIn || !checkOut) return 1;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 1;
  return Math.max(1, Math.ceil((b - a) / 86400000));
}

const CHARGE_LABEL: Record<string, string> = {
  food: "Food / Room Service",
  bar: "Bar",
  spa: "Spa",
  minibar: "Mini Bar",
  laundry: "Laundry",
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
};

export async function computeRoomFolio(restaurantId: number, roomNumber: string) {
  const [room] = await db.select().from(hotelRoomsTable)
    .where(and(eq(hotelRoomsTable.restaurantId, restaurantId), eq(hotelRoomsTable.number, roomNumber)));

  const billing = readRoomBilling(room);
  const nights = nightsBetween(room?.checkIn, room?.checkOut);
  const roomRent = roundMoney((billing.rate ?? 0) * nights);
  const discount = roundMoney(billing.discount ?? 0);

  const requests = await db.select().from(roomServiceRequestsTable)
    .where(and(eq(roomServiceRequestsTable.restaurantId, restaurantId), eq(roomServiceRequestsTable.roomNumber, roomNumber)));

  const serviceLines = requests
    .filter(r => r.status !== "cancelled")
    .map(r => {
      const items = Array.isArray(r.items) ? r.items : [];
      const label = r.notes
        || items.map((i: any) => (i.qty ? `${i.qty}x ` : "") + (i.name ?? i.description ?? "")).filter(Boolean).join(", ")
        || CHARGE_LABEL[r.type] || r.type;
      return {
        id: r.id,
        kind: r.type,
        typeLabel: CHARGE_LABEL[r.type] || r.type,
        label,
        amount: roundMoney(parseMoney(r.total)),
        status: r.status,
        at: r.createdAt,
      };
    });

  const servicesTotal = roundMoney(serviceLines.reduce((s, l) => s + l.amount, 0));
  const lines = [
    ...(roomRent > 0
      ? [{ id: 0, kind: "room_rent", typeLabel: "Room Rent", label: `${(room?.type || "room")} x ${nights} night(s) @ ${billing.rate}`, amount: roomRent, status: "posted", at: room?.checkIn ?? room?.createdAt ?? null }]
      : []),
    ...serviceLines,
  ];

  const subtotal = roundMoney(roomRent + servicesTotal);
  const total = roundMoney(Math.max(0, subtotal - discount));
  const paid = roundMoney(billing.paid ?? 0);
  const balance = roundMoney(Math.max(0, total - paid));

  return {
    room: room
      ? {
          id: room.id, number: room.number, type: room.type, status: room.status,
          guestName: room.guestName, guestPhone: room.guestPhone,
          checkIn: room.checkIn, checkOut: room.checkOut,
          rate: billing.rate ?? 0, discount, guestCount: billing.guestCount ?? 1, nights,
        }
      : null,
    lines,
    roomRent,
    servicesTotal,
    discount,
    subtotal,
    total,
    paid,
    balance,
  };
}
