import type { Response } from "express";
import { randomUUID } from "crypto";

interface SSEClient {
  id: string;
  res: Response;
  userId?: number;
  /** Staff clients carry the restaurant they signed in to, so a broadcast can be scoped. */
  restaurantId?: number;
  orderId?: number;
}

const clients = new Map<string, SSEClient>();

export function addSSEClient(res: Response, userId?: number, restaurantId?: number): () => void {
  const id = randomUUID();
  clients.set(id, { id, res, userId, restaurantId });
  return () => clients.delete(id);
}

export function addOrderSSEClient(res: Response, orderId: number): () => void {
  const id = randomUUID();
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ orderId })}\n\n`);
  clients.set(id, { id, res, orderId });
  return () => clients.delete(id);
}

/**
 * Staff-channel broadcast.
 *
 * This used to write to EVERY connected client, so one venue's new_order — table name
 * and bill total included — landed in every other venue's open panel, and in the browser
 * of any guest sitting on an order-tracking page. Two rules fix that without changing
 * what a correctly-scoped client receives:
 *
 *   1. Guest clients are subscribed to a single order; broadcastOrderEvent serves them,
 *      and they never need the staff feed.
 *   2. When the payload names a restaurant, only that restaurant's staff receive it.
 *
 * Both checks fail open: a payload with no restaurantId, or a client that never recorded
 * one (a super-admin session), still receives everything — so nothing that works today
 * stops working.
 */
export function broadcastEvent(event: string, data: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const raw = data && typeof data === "object" ? (data as { restaurantId?: unknown }).restaurantId : undefined;
  const target = Number(raw);
  const scoped = Number.isFinite(target) && target > 0;

  for (const [id, client] of clients) {
    if (client.orderId != null) continue;
    if (scoped && client.restaurantId != null && client.restaurantId !== target) continue;
    try {
      client.res.write(msg);
    } catch {
      clients.delete(id);
    }
  }
}

export function broadcastOrderEvent(orderId: number, event: string, data: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of clients) {
    if (client.orderId !== orderId) continue;
    try {
      client.res.write(msg);
    } catch {
      clients.delete(id);
    }
  }
}

export function getClientCount(): number {
  return clients.size;
}
