import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";
import { getBarCatalog, HAPPY_HOUR } from "../lib/barNightlifeLogic.js";

const router: IRouter = Router();

const DEFAULT_INVENTORY = [
  { id: "BI01", name: "Old Monk Rum", category: "spirits", price: 280, stock: 8, minStock: 5, unit: "bottle" },
  { id: "BI02", name: "Johnny Walker Black", category: "spirits", price: 1200, stock: 3, minStock: 4, unit: "bottle" },
  { id: "BI03", name: "Kingfisher Premium", category: "beer", price: 180, stock: 24, minStock: 12, unit: "can" },
  { id: "BI04", name: "Heineken", category: "beer", price: 280, stock: 18, minStock: 12, unit: "bottle" },
  { id: "BI05", name: "House Red Wine", category: "wine", price: 680, stock: 12, minStock: 6, unit: "bottle" },
  { id: "BI06", name: "Prosecco", category: "wine", price: 1400, stock: 6, minStock: 4, unit: "bottle" },
  { id: "BI07", name: "Classic Mojito", category: "cocktail", price: 380, stock: 999, minStock: 0, unit: "serve" },
  { id: "BI08", name: "Watermelon Margarita", category: "cocktail", price: 420, stock: 999, minStock: 0, unit: "serve" },
  { id: "BI09", name: "Blue Lagoon", category: "mocktail", price: 220, stock: 999, minStock: 0, unit: "serve" },
  { id: "BI10", name: "Virgin Mojito", category: "mocktail", price: 180, stock: 999, minStock: 0, unit: "serve" },
];

const DEFAULT_RECIPES = [
  { name: "Classic Mojito", ingredients: ["White Rum 60ml", "Fresh Lime Juice 30ml", "Mint Leaves 10", "Sugar Syrup 15ml", "Soda Water 100ml"], glass: "Highball", garnish: "Mint sprig + lime wheel", prep: "Muddle mint, add ice, pour rum + juice + syrup, top soda" },
  { name: "Watermelon Margarita", ingredients: ["Tequila 45ml", "Triple Sec 22ml", "Fresh Watermelon Juice 60ml", "Lime Juice 30ml", "Salt rim"], glass: "Margarita", garnish: "Watermelon wedge + salt rim", prep: "Shake all with ice, strain into salt-rimmed glass" },
  { name: "Blue Lagoon (Mocktail)", ingredients: ["Blue Curacao Syrup 30ml", "Lemonade 150ml", "Pineapple Juice 60ml", "Ice"], glass: "Hurricane", garnish: "Cherry + umbrella", prep: "Pour syrup, add ice, pour juices, stir gently" },
];

async function loadBarSection<T>(rid: number, key: string, emptyDefault: T): Promise<T> {
  const stored = await getSettingsSection<Record<string, unknown>>(rid, "barAdmin", {});
  const val = stored[key];
  if (Array.isArray(val)) return (val.length ? val : emptyDefault) as T;
  if (val && typeof val === "object" && !Array.isArray(val)) return { ...(emptyDefault as object), ...(val as object) } as T;
  return emptyDefault;
}

async function saveBarSection(rid: number, key: string, value: unknown) {
  const current = await getSettingsSection<Record<string, unknown>>(rid, "barAdmin", {});
  await setSettingsSection(rid, "barAdmin", { ...current, [key]: value });
}

router.get("/restaurants/:restaurantId/bar/inventory", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const inventory = await loadBarSection(rid, "inventory", [] as typeof DEFAULT_INVENTORY);
  res.json(inventory);
});

router.put("/restaurants/:restaurantId/bar/inventory", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { items } = req.body as { items?: typeof DEFAULT_INVENTORY };
  if (!Array.isArray(items)) { res.status(400).json({ error: "items array required" }); return; }
  await saveBarSection(rid, "inventory", items);
  res.json({ success: true, items });
});

router.patch("/restaurants/:restaurantId/bar/inventory/:itemId", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const itemId = req.params.itemId;
  const inventory = await loadBarSection(rid, "inventory", [] as typeof DEFAULT_INVENTORY);
  const idx = inventory.findIndex(i => i.id === itemId);
  if (idx < 0) { res.status(404).json({ error: "Item not found" }); return; }
  inventory[idx] = { ...inventory[idx], ...req.body };
  await saveBarSection(rid, "inventory", inventory);
  res.json(inventory[idx]);
});

router.get("/restaurants/:restaurantId/bar/recipes", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const recipes = await loadBarSection(rid, "recipes", [] as typeof DEFAULT_RECIPES);
  res.json(recipes);
});

router.put("/restaurants/:restaurantId/bar/recipes", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { recipes } = req.body;
  if (!Array.isArray(recipes)) { res.status(400).json({ error: "recipes array required" }); return; }
  await saveBarSection(rid, "recipes", recipes);
  res.json({ success: true, recipes });
});

router.get("/restaurants/:restaurantId/bar/catalog", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const catalogOverrides = await getSettingsSection(rid, "barCatalog", {});
  const happyHour = await getSettingsSection(rid, "barHappyHour", HAPPY_HOUR);
  res.json({ ...getBarCatalog(), happyHour, ...catalogOverrides });
});

router.put("/restaurants/:restaurantId/bar/happy-hour", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  await setSettingsSection(rid, "barHappyHour", req.body);
  res.json({ success: true, happyHour: req.body });
});

export default router;
