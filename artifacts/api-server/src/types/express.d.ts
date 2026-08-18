import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    guestUserId?: number;
    restaurantId?: number;
    guestSessionToken?: string;
    guestSessionId?: number;
  }
}
