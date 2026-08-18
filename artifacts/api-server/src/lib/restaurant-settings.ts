import { eq } from "drizzle-orm";
import { db, restaurantsTable } from "@workspace/db";

export type RestaurantSettings = Record<string, unknown>;

export async function getRestaurantSettings(restaurantId: number): Promise<RestaurantSettings> {
  const [row] = await db.select({ settings: restaurantsTable.settings }).from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  const s = row?.settings;
  return (s && typeof s === "object" && !Array.isArray(s) ? s : {}) as RestaurantSettings;
}

export async function updateRestaurantSettings(
  restaurantId: number,
  patch: RestaurantSettings,
): Promise<RestaurantSettings> {
  const current = await getRestaurantSettings(restaurantId);
  const merged = { ...current, ...patch };
  await db.update(restaurantsTable).set({ settings: merged }).where(eq(restaurantsTable.id, restaurantId));
  return merged;
}

export async function getSettingsSection<T>(restaurantId: number, key: string, fallback: T): Promise<T> {
  const settings = await getRestaurantSettings(restaurantId);
  const section = settings[key];
  return (section !== undefined && section !== null ? section : fallback) as T;
}

export async function setSettingsSection<T>(restaurantId: number, key: string, value: T): Promise<T> {
  await updateRestaurantSettings(restaurantId, { [key]: value });
  return value;
}
