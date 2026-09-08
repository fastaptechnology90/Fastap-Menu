import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  recipesTable,
  recipeIngredientsTable,
  inventoryItemsTable,
  inventoryTransactionsTable,
} from "@workspace/db";
import { logger } from "./logger.js";

/**
 * Take ingredients out of stock when a dish is sold.
 *
 * Placing an order used to bump `menu_items.order_count` and nothing else: selling forty
 * biryanis left the rice untouched, so the Inventory page only ever moved when someone
 * typed a restock in by hand. Recipes and their ingredient rows already existed — with an
 * `inventory_item_id` on each ingredient — and were simply never read at order time.
 *
 * A recipe is matched to a menu item by name, which is how the two are related in this
 * schema. An item with no recipe consumes nothing, which is the right behaviour for
 * bought-in goods like bottled drinks.
 *
 * This is deliberately best-effort and never blocks an order: a kitchen must be able to
 * serve a guest even if the stock bookkeeping is incomplete. Anything unusual is logged
 * rather than raised.
 */

type SoldLine = { name: string; quantity: number };

export async function consumeStockForOrder(
  restaurantId: number,
  orderId: number,
  lines: SoldLine[],
): Promise<void> {
  if (!lines.length) return;

  try {
    const names = [...new Set(lines.map(l => l.name?.trim()).filter(Boolean) as string[])];
    if (!names.length) return;

    const recipes = await db
      .select()
      .from(recipesTable)
      .where(and(eq(recipesTable.restaurantId, restaurantId), inArray(recipesTable.name, names)));
    if (!recipes.length) return;

    const recipeByName = new Map(recipes.map(r => [r.name.trim().toLowerCase(), r]));

    const ingredients = await db
      .select()
      .from(recipeIngredientsTable)
      .where(inArray(recipeIngredientsTable.recipeId, recipes.map(r => r.id)));
    if (!ingredients.length) return;

    // Total each inventory item across every line first, so a dish appearing twice in one
    // order results in one stock movement rather than two.
    const required = new Map<number, number>();
    for (const line of lines) {
      const recipe = recipeByName.get(String(line.name ?? "").trim().toLowerCase());
      if (!recipe) continue;

      // A recipe yields `servings` portions, so one sold portion consumes 1/servings of it.
      const servings = Math.max(1, Number(recipe.servings) || 1);
      const portions = (Number(line.quantity) || 0) / servings;
      if (portions <= 0) continue;

      for (const ing of ingredients) {
        if (ing.recipeId !== recipe.id || ing.inventoryItemId == null) continue;
        const perServing = Number(ing.quantity) || 0;
        if (perServing <= 0) continue;
        required.set(ing.inventoryItemId, (required.get(ing.inventoryItemId) ?? 0) + perServing * portions);
      }
    }
    if (!required.size) return;

    const itemIds = [...required.keys()];
    const stockItems = await db
      .select()
      .from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.restaurantId, restaurantId), inArray(inventoryItemsTable.id, itemIds)));

    for (const item of stockItems) {
      const used = required.get(item.id);
      if (!used || used <= 0) continue;

      const before = Number(item.currentStock) || 0;
      // Clamp at zero. A negative stock figure is meaningless and would quietly corrupt
      // every valuation and reorder calculation downstream; the shortfall is logged instead.
      const after = Math.max(0, before - used);
      if (before - used < 0) {
        logger.warn(
          { restaurantId, orderId, itemId: item.id, item: item.name, have: before, needed: used },
          "stock went below zero on sale — recorded down to zero",
        );
      }

      await db
        .update(inventoryItemsTable)
        .set({ currentStock: after.toFixed(3), lastUpdated: new Date() })
        .where(eq(inventoryItemsTable.id, item.id));

      // The ledger is what makes stock auditable — a current quantity alone cannot answer
      // "where did it go?". `inventory_transactions` already existed and orders never wrote to it.
      await db.insert(inventoryTransactionsTable).values({
        restaurantId,
        itemId: item.id,
        type: "out",
        quantity: used.toFixed(3),
        reason: "Sold",
        reference: `ORD-${orderId}`,
        performedBy: "system",
      });
    }
  } catch (err) {
    logger.error({ err, restaurantId, orderId }, "could not apply stock consumption for order");
  }
}

/**
 * Put ingredients back when an order is cancelled. Without this a cancelled order would
 * permanently understate stock, and the count would drift further from reality every day.
 */
export async function restoreStockForOrder(restaurantId: number, orderId: number): Promise<void> {
  try {
    const movements = await db
      .select()
      .from(inventoryTransactionsTable)
      .where(
        and(
          eq(inventoryTransactionsTable.restaurantId, restaurantId),
          eq(inventoryTransactionsTable.reference, `ORD-${orderId}`),
          eq(inventoryTransactionsTable.type, "out"),
        ),
      );
    if (!movements.length) return;

    for (const movement of movements) {
      const qty = Number(movement.quantity) || 0;
      if (qty <= 0) continue;

      await db
        .update(inventoryItemsTable)
        .set({
          currentStock: sql`${inventoryItemsTable.currentStock} + ${qty.toFixed(3)}`,
          lastUpdated: new Date(),
        })
        .where(eq(inventoryItemsTable.id, movement.itemId));

      await db.insert(inventoryTransactionsTable).values({
        restaurantId,
        itemId: movement.itemId,
        type: "in",
        quantity: qty.toFixed(3),
        reason: "Order cancelled",
        reference: `ORD-${orderId}`,
        performedBy: "system",
      });
    }
  } catch (err) {
    logger.error({ err, restaurantId, orderId }, "could not restore stock for cancelled order");
  }
}
