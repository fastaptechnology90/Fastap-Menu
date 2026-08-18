import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, recipesTable, recipeIngredientsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/recipes", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const recipes = await db.select().from(recipesTable).where(eq(recipesTable.restaurantId, id));
  const result = await Promise.all(recipes.map(async r => {
    const ingredients = await db.select().from(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, r.id));
    return {
      ...r,
      sellingPrice: parseFloat(String(r.sellingPrice)),
      totalCost: parseFloat(String(r.totalCost)),
      profitMargin: parseFloat(String(r.profitMargin)),
      ingredients: ingredients.map(i => ({ ...i, quantity: parseFloat(String(i.quantity)), costPerUnit: parseFloat(String(i.costPerUnit)), totalCost: parseFloat(String(i.totalCost)) })),
    };
  }));
  res.json(result);
});

router.post("/restaurants/:restaurantId/recipes", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, category, servings, preparationTime, sellingPrice, instructions, ingredients } = req.body;
  let totalCost = 0;
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) {
      totalCost += (parseFloat(ing.quantity) || 0) * (parseFloat(ing.costPerUnit) || 0);
    }
  }
  const profitMargin = sellingPrice > 0 ? ((parseFloat(sellingPrice) - totalCost) / parseFloat(sellingPrice)) * 100 : 0;
  const [recipe] = await db.insert(recipesTable).values({
    restaurantId: id, name, category, servings: parseInt(servings) || 1,
    preparationTime: parseInt(preparationTime) || 0,
    sellingPrice: String(parseFloat(sellingPrice) || 0),
    totalCost: String(totalCost.toFixed(2)),
    profitMargin: String(profitMargin.toFixed(2)),
    instructions,
  }).returning();
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) {
      const ingCost = (parseFloat(ing.quantity) || 0) * (parseFloat(ing.costPerUnit) || 0);
      await db.insert(recipeIngredientsTable).values({
        recipeId: recipe.id, restaurantId: id,
        ingredientName: ing.name, quantity: String(ing.quantity),
        unit: ing.unit, costPerUnit: String(ing.costPerUnit),
        totalCost: String(ingCost.toFixed(2)),
        inventoryItemId: ing.inventoryItemId ?? null,
      });
    }
  }
  res.status(201).json(recipe);
});

router.put("/restaurants/:restaurantId/recipes/:recipeId", requireAuth, async (req, res): Promise<void> => {
  const recipeId = parseInt(req.params.recipeId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, category, servings, preparationTime, sellingPrice, instructions, ingredients } = req.body;
  let totalCost = 0;
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) totalCost += (parseFloat(ing.quantity) || 0) * (parseFloat(ing.costPerUnit) || 0);
  }
  const profitMargin = sellingPrice > 0 ? ((parseFloat(sellingPrice) - totalCost) / parseFloat(sellingPrice)) * 100 : 0;
  const [recipe] = await db.update(recipesTable).set({
    name, category, servings: parseInt(servings) || 1,
    preparationTime: parseInt(preparationTime) || 0,
    sellingPrice: String(parseFloat(sellingPrice) || 0),
    totalCost: String(totalCost.toFixed(2)),
    profitMargin: String(profitMargin.toFixed(2)),
    instructions,
  }).where(and(eq(recipesTable.id, recipeId), eq(recipesTable.restaurantId, restaurantId))).returning();
  if (!recipe) { res.status(404).json({ error: "Recipe not found" }); return; }
  if (Array.isArray(ingredients)) {
    await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipeId));
    for (const ing of ingredients) {
      const ingCost = (parseFloat(ing.quantity) || 0) * (parseFloat(ing.costPerUnit) || 0);
      await db.insert(recipeIngredientsTable).values({
        recipeId: recipe.id, restaurantId,
        ingredientName: ing.name, quantity: String(ing.quantity),
        unit: ing.unit, costPerUnit: String(ing.costPerUnit),
        totalCost: String(ingCost.toFixed(2)),
      });
    }
  }
  res.json(recipe);
});

router.delete("/restaurants/:restaurantId/recipes/:recipeId", requireAuth, async (req, res): Promise<void> => {
  const recipeId = parseInt(req.params.recipeId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(recipeIngredientsTable).where(eq(recipeIngredientsTable.recipeId, recipeId));
  await db.delete(recipesTable).where(and(eq(recipesTable.id, recipeId), eq(recipesTable.restaurantId, restaurantId)));
  res.json({ message: "Recipe deleted" });
});

export default router;
