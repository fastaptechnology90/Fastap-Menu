import { type Request, type Response, type NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    staffSession?: {
      staffId: string;
      staffName: string;
      staffRole: string;
      restaurantId: number;
    };
  }
}

export function requireRestaurantAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session.userId || req.session.staffSession) {
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}

export function getRestaurantId(req: Request): number | null {
  if (req.session.staffSession) return req.session.staffSession.restaurantId;
  return null;
}
