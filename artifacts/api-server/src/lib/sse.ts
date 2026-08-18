import type { Response } from "express";
import { randomUUID } from "crypto";

interface SSEClient {
  id: string;
  res: Response;
  userId?: number;
  orderId?: number;
}

const clients = new Map<string, SSEClient>();

export function addSSEClient(res: Response, userId?: number): () => void {
  const id = randomUUID();
  clients.set(id, { id, res, userId });
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

export function broadcastEvent(event: string, data: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [id, client] of clients) {
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
