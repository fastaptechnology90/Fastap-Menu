#!/usr/bin/env node
/**
 * Builds three complete, believable venues so the app can be opened and used rather than
 * just inspected: a casual-dining restaurant in Indore, a hotel in Udaipur with rooms and
 * 24-hour room service, and a small cafe in Bandra.
 *
 * Why this lives beside artifacts/api-server/src/seed.ts rather than inside it: that seed
 * builds the one venue every smoke test and the e2e path are pinned to, and widening it
 * would move the ground those tests stand on. This script only ever adds venues of its
 * own, so the two can run in either order.
 *
 * Idempotent. Every row is keyed on something natural (restaurant slug, staff email,
 * venue + dish name, venue + invoice number), so a second run refreshes rather than
 * duplicates. It writes real rows, so point it at a database you are willing to change.
 *
 *   node scripts/seed-demo-world.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// pg and bcryptjs belong to workspace packages, not to the root manifest. Resolving from
// the packages that own them avoids adding root dependencies just to run a seed.
const requireDb = createRequire(path.join(ROOT, "lib/db/package.json"));
const requireApi = createRequire(path.join(ROOT, "artifacts/api-server/package.json"));
const { Client } = requireDb("pg");
const bcrypt = requireApi("bcryptjs");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://fastapmenu:fastapmenu@localhost:5455/fastapmenu";
const API = process.env.API_BASE || "http://localhost:8080/api";
const STAFF_PASSWORD = process.env.SEED_DEMO_PASSWORD || "Fastap@2026";

const db = new Client({ connectionString: DATABASE_URL });
const q = async (text, params = []) => (await db.query(text, params)).rows;
const J = (v) => JSON.stringify(v ?? null);
const money = (n) => Number(n).toFixed(2);

/**
 * Insert when the natural key is absent, refresh the row when it is present.
 *
 * Re-running after a price or description edit should move the database, which a plain
 * insert-if-missing guard would not do. Columns not listed in `values` are left untouched
 * so a re-run never clobbers state the running app has changed since.
 */
async function ensure(table, key, values, { update = true } = {}) {
  const keyCols = Object.keys(key);
  const where = keyCols.map((c, i) => `"${c}" = $${i + 1}`).join(" and ");
  const [existing] = await q(`select * from "${table}" where ${where} limit 1`, Object.values(key));

  if (existing) {
    const cols = Object.keys(values).filter((c) => !keyCols.includes(c));
    if (!update || !cols.length) return existing;
    const sets = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
    const [row] = await q(
      `update "${table}" set ${sets} where id = $${cols.length + 1} returning *`,
      [...cols.map((c) => values[c]), existing.id],
    );
    return row;
  }

  const all = { ...key, ...values };
  const cols = Object.keys(all);
  const [row] = await q(
    `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")})
     values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
    cols.map((c) => all[c]),
  );
  return row;
}

/** Days back from now at a given hour — orders have to land inside the analytics windows. */
function at(daysAgo, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Fixed-seed PRNG: the generated order history must be identical on every run, or the
 *  invoice numbers would not line up and re-seeding would duplicate the lot. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===========================================================================
// Venues
// ===========================================================================

const VENUES = [
  {
    slug: "kesar-kitchen",
    prefix: "KK",
    name: "Kesar Kitchen",
    description:
      "Slow-cooked North Indian and Mughlai food from a family kitchen that has fed New Palasia since 1998. Charcoal tandoor, hand-ground masalas, nothing rushed.",
    address: "142 New Palasia, above Sarafa Corner, Indore, Madhya Pradesh 452001",
    phone: "+91 731 4055220",
    email: "hello@kesarkitchen.in",
    website: "https://kesarkitchen.in",
    domain: "kesarkitchen.in",
    businessType: "restaurant",
    primaryColor: "#c2410c",
    gst: "23AACCK4521M1ZP",
    fssai: "11523045000876",
    openTime: "11:30",
    closeTime: "23:30",
    plan: "pro",
    cuisines: ["North Indian", "Mughlai", "Tandoor"],
    owner: { name: "Arun Kesarwani", email: "arun.kesarwani@kesarkitchen.in" },
    branch: { name: "New Palasia", address: "142 New Palasia, Indore 452001", phone: "+91 731 4055220" },
  },
  {
    slug: "meghdoot-residency",
    prefix: "HMR",
    name: "Hotel Meghdoot Residency",
    description:
      "A twenty-four room hotel a short walk from Fatehsagar, with an all-day dining room, a Rajasthani thali counter and round-the-clock room service.",
    address: "Plot 7, Fatehsagar Road, Udaipur, Rajasthan 313001",
    phone: "+91 294 2431900",
    email: "frontdesk@meghdootresidency.in",
    website: "https://meghdootresidency.in",
    domain: "meghdootresidency.in",
    businessType: "hotel",
    primaryColor: "#0f766e",
    gst: "08AAECM7734L1Z9",
    fssai: "22319045001204",
    openTime: "06:30",
    closeTime: "23:00",
    plan: "enterprise",
    cuisines: ["Rajasthani", "North Indian", "Continental"],
    owner: { name: "Devendra Singh Rathore", email: "devendra.rathore@meghdootresidency.in" },
    branch: { name: "Fatehsagar", address: "Plot 7, Fatehsagar Road, Udaipur 313001", phone: "+91 294 2431900" },
  },
  {
    slug: "bombay-bun-co",
    prefix: "BBC",
    name: "Bombay Bun Company",
    description:
      "A twelve-seat corner cafe off Pali Naka that roasts its own single origin and bakes through the morning. Bun maska from seven, sourdough from nine.",
    address: "Shop 3, Pali Naka, Bandra West, Mumbai, Maharashtra 400050",
    phone: "+91 22 26057788",
    email: "hello@bombaybun.in",
    website: "https://bombaybun.in",
    domain: "bombaybun.in",
    businessType: "cafe",
    primaryColor: "#7c2d12",
    gst: "27AAFCB9902R1ZK",
    fssai: "11521999000342",
    openTime: "07:30",
    closeTime: "22:30",
    plan: "starter",
    cuisines: ["Cafe", "Bakery", "Breakfast"],
    owner: { name: "Farah Mistry", email: "farah.mistry@bombaybun.in" },
    branch: { name: "Pali Naka", address: "Shop 3, Pali Naka, Bandra West, Mumbai 400050", phone: "+91 22 26057788" },
  },
];

/** Role strings must match restaurant-auth's STAFF_ROLES or the account exists but cannot sign in. */
const STAFF = {
  "kesar-kitchen": [
    ["Arun Kesarwani", "arun.kesarwani", "owner", "9826011201", "General", 0],
    ["Sunita Bhargava", "sunita.bhargava", "manager", "9826011202", "Morning", 42000],
    ["Rakesh Yadav", "rakesh.yadav", "cashier", "9826011203", "Evening", 24000],
    ["Imran Qureshi", "imran.qureshi", "waiter", "9826011204", "Evening", 19000],
    ["Deepa Nair", "deepa.nair", "waiter", "9826011205", "Morning", 19000],
    ["Kailash Vishwakarma", "kailash.vishwakarma", "chef", "9826011206", "Split", 58000],
    ["Munna Sahu", "munna.sahu", "kitchen", "9826011207", "Morning", 21000],
    ["Neha Jain", "neha.jain", "reception", "9826011208", "Evening", 22000],
    ["Ramkishan Patel", "ramkishan.patel", "housekeeping", "9826011209", "Morning", 17000],
    ["Vaibhav Agrawal", "vaibhav.agrawal", "finance", "9826011210", "General", 46000],
    ["Salim Ansari", "salim.ansari", "bar", "9826011211", "Evening", 26000],
  ],
  "meghdoot-residency": [
    ["Devendra Singh Rathore", "devendra.rathore", "owner", "9414022301", "General", 0],
    ["Anita Chouhan", "anita.chouhan", "manager", "9414022302", "General", 55000],
    ["Bhawani Shankar", "bhawani.shankar", "cashier", "9414022303", "Evening", 26000],
    ["Pooja Rathi", "pooja.rathi", "waiter", "9414022304", "Morning", 20000],
    ["Girdhari Lal", "girdhari.lal", "waiter", "9414022305", "Night", 21000],
    ["Mahesh Solanki", "mahesh.solanki", "chef", "9414022306", "Split", 62000],
    ["Kanhaiya Meena", "kanhaiya.meena", "kitchen", "9414022307", "Night", 22000],
    ["Ritika Purohit", "ritika.purohit", "reception", "9414022308", "Morning", 27000],
    ["Sushila Devi", "sushila.devi", "housekeeping", "9414022309", "Morning", 18000],
    ["Naresh Vyas", "naresh.vyas", "finance", "9414022310", "General", 52000],
    ["Yogesh Paliwal", "yogesh.paliwal", "spa", "9414022311", "Evening", 30000],
    ["Sameer Khan", "sameer.khan", "bar", "9414022312", "Evening", 28000],
  ],
  "bombay-bun-co": [
    ["Farah Mistry", "farah.mistry", "owner", "9820033401", "General", 0],
    ["Kunal Shirke", "kunal.shirke", "manager", "9820033402", "Morning", 38000],
    ["Tanvi Rane", "tanvi.rane", "cashier", "9820033403", "Morning", 23000],
    ["Aditya Gawde", "aditya.gawde", "waiter", "9820033404", "Evening", 18000],
    ["Joel Fernandes", "joel.fernandes", "chef", "9820033405", "Morning", 47000],
    ["Shabana Shaikh", "shabana.shaikh", "kitchen", "9820033406", "Morning", 20000],
    ["Meera Kulkarni", "meera.kulkarni", "reception", "9820033407", "Evening", 21000],
    ["Laxman Pawar", "laxman.pawar", "housekeeping", "9820033408", "Morning", 16000],
    ["Rohan Deshpande", "rohan.deshpande", "finance", "9820033409", "General", 41000],
  ],
};

// ===========================================================================
// Menus
//
// veg/nonveg map onto the dietary tags the guest menu filter actually reads:
// its "veg" case looks for a tag containing "vegetarian" / "vegan" / "jain",
// so a bare "veg" tag would be filtered out. See MenuPage matchesDietaryFilter.
// Variant prices are the FULL price of that portion, not a surcharge — that is
// how lib/order-pricing.ts reads them.
// ===========================================================================

const CATEGORIES = {
  "kesar-kitchen": [
    ["starters", "Starters", "food", 1],
    ["tandoor", "From the Tandoor", "food", 2],
    ["main-veg", "Main Course - Veg", "food", 3],
    ["main-nonveg", "Main Course - Non Veg", "food", 4],
    ["breads-rice", "Breads & Rice", "food", 5],
    ["desserts", "Desserts", "food", 6],
    ["beverages", "Beverages", "beverages", 7],
  ],
  "meghdoot-residency": [
    ["all-day-dining", "All Day Dining", "food", 1],
    ["rajasthani", "Rajasthani Specials", "food", 2],
    ["continental", "Continental", "food", 3],
    ["room-service", "In-Room Dining", "food", 4],
    ["desserts", "Desserts", "food", 5],
    ["beverages", "Beverages", "beverages", 6],
  ],
  "bombay-bun-co": [
    ["coffee", "Coffee", "beverages", 1],
    ["cold", "Cold Brews & Shakes", "beverages", 2],
    ["bakes", "From the Bakery", "food", 3],
    ["breakfast", "All Day Breakfast", "food", 4],
    ["sandwiches", "Sandwiches & Rolls", "food", 5],
    ["desserts", "Desserts", "food", 6],
  ],
};

// [cat, name, price, veg|nonveg|egg, spice, prepMin, description, extras]
const MENU = {
  "kesar-kitchen": [
    ["starters", "Paneer Tikka Lasooni", 285, "veg", 2, 18, "Malai-marinated cottage cheese with roasted garlic, finished over charcoal", { variants: [["Half", 175], ["Full", 285]], addons: [["Extra Mint Chutney", 30], ["Extra Onion Salad", 25]], cal: 340, protein: 19, carbs: 12, method: "Tandoor grilled", ingredients: "Paneer, hung curd, garlic, capsicum, kasuri methi", allergens: "dairy", featured: true, chef: true, orders: 412 }],
    ["starters", "Dahi Ke Kebab", 245, "veg", 1, 16, "Hung curd and cashew patties, crisp outside and barely set within", { cal: 290, protein: 11, carbs: 22, method: "Shallow fried", ingredients: "Hung curd, cashew, green chilli, bread crumb", allergens: "dairy, nuts, gluten", orders: 188 }],
    ["starters", "Chilli Paneer Dry", 265, "veg", 3, 14, "Indo-Chinese counter favourite, tossed hot with capsicum and spring onion", { addons: [["Extra Schezwan", 30]], cal: 380, protein: 17, carbs: 28, method: "Wok tossed", allergens: "dairy, soy, gluten", orders: 233 }],
    ["starters", "Murgh Malai Tikka", 345, "nonveg", 1, 20, "Chicken thigh in cream cheese and white pepper, mild and smoky", { variants: [["Half", 210], ["Full", 345]], addons: [["Extra Mint Chutney", 30]], cal: 410, protein: 34, carbs: 6, method: "Tandoor grilled", ingredients: "Chicken, cream, cheese, white pepper, cardamom", allergens: "dairy", featured: true, orders: 356 }],
    ["starters", "Amritsari Fish Tikka", 425, "nonveg", 2, 18, "Basa in ajwain and gram flour batter, fried to order with pickled onion", { cal: 380, protein: 31, carbs: 18, method: "Deep fried", allergens: "fish, gluten", orders: 141 }],
    ["starters", "Mutton Shami Kebab", 395, "nonveg", 2, 22, "Fine-ground mutton and chana dal patties, a Lucknow recipe", { cal: 430, protein: 29, carbs: 14, method: "Griddle seared", orders: 167, chef: true }],
    ["tandoor", "Tandoori Chicken", 620, "nonveg", 2, 28, "Half or full bird, marinated overnight in curd, chilli and mustard oil", { variants: [["Half", 340], ["Full", 620]], addons: [["Extra Onion Salad", 25], ["Extra Mint Chutney", 30]], cal: 720, protein: 62, carbs: 8, method: "Charcoal tandoor", allergens: "dairy", featured: true, chef: true, orders: 498 }],
    ["tandoor", "Achari Jhinga", 545, "nonveg", 2, 20, "Prawns in a pickling masala of fennel, nigella and mustard", { cal: 340, protein: 36, carbs: 9, method: "Tandoor grilled", allergens: "shellfish, dairy", orders: 96 }],
    ["main-veg", "Paneer Butter Masala", 295, "veg", 1, 20, "Cashew and tomato gravy simmered down slowly, finished with white butter", { addons: [["Extra Gravy", 60], ["Extra Paneer", 90]], cal: 470, protein: 21, carbs: 24, method: "Slow simmered", ingredients: "Paneer, tomato, cashew, butter, cream", allergens: "dairy, nuts", featured: true, orders: 521 }],
    ["main-veg", "Dal Kesar", 285, "veg", 1, 24, "The house black dal, on the range overnight with butter and cream", { variants: [["Half", 175], ["Full", 285]], addons: [["Extra Butter", 35]], cal: 420, protein: 18, carbs: 38, method: "Overnight simmer", ingredients: "Urad dal, tomato, butter, cream, ginger", allergens: "dairy", featured: true, chef: true, orders: 604 }],
    ["main-veg", "Kadhai Vegetable", 265, "veg", 2, 18, "Seasonal vegetables in a coarse-ground coriander and chilli masala", { cal: 310, protein: 9, carbs: 32, method: "Wok tossed", orders: 174 }],
    ["main-veg", "Malai Kofta", 305, "veg", 1, 22, "Paneer and potato dumplings in a mild saffron cashew gravy", { addons: [["Extra Gravy", 60]], cal: 520, protein: 16, carbs: 34, allergens: "dairy, nuts", orders: 218 }],
    ["main-veg", "Sarson Ka Saag", 275, "veg", 2, 26, "Winter mustard greens slow-cooked with makki atta and white butter", { cal: 280, protein: 11, carbs: 21, allergens: "dairy", orders: 132 }],
    ["main-nonveg", "Murgh Makhani", 495, "nonveg", 1, 24, "Tandoori chicken folded into tomato gravy with butter and fenugreek", { variants: [["Half", 320], ["Full", 495]], addons: [["Extra Gravy", 70], ["Extra Butter", 35]], cal: 610, protein: 44, carbs: 22, method: "Slow simmered", ingredients: "Chicken, tomato, butter, cream, cashew, kasuri methi", allergens: "dairy, nuts", featured: true, chef: true, orders: 712 }],
    ["main-nonveg", "Laal Maas", 545, "nonveg", 4, 32, "Mutton in Mathania chilli and mustard oil, cooked the way Marwar does it", { cal: 640, protein: 46, carbs: 12, method: "Pressure cooked", ingredients: "Mutton, Mathania chilli, mustard oil, garlic, curd", allergens: "dairy", chef: true, orders: 289 }],
    ["main-nonveg", "Kadhai Chicken", 470, "nonveg", 3, 22, "Boneless chicken with capsicum, tomato and freshly pounded coriander seed", { variants: [["Half", 310], ["Full", 470]], cal: 540, protein: 42, carbs: 18, orders: 331 }],
    ["main-nonveg", "Rogan Josh", 525, "nonveg", 3, 30, "Kashmiri lamb curry with ratanjot, fennel and dry ginger", { cal: 590, protein: 43, carbs: 14, allergens: "dairy", orders: 176 }],
    ["main-nonveg", "Egg Curry Dhaba Style", 235, "egg", 2, 16, "Boiled eggs in a robust onion tomato masala, the highway version", { cal: 360, protein: 20, carbs: 18, allergens: "egg", orders: 148 }],
    ["breads-rice", "Butter Naan", 65, "veg", 0, 8, "Leavened white flour bread from the tandoor, brushed with butter", { cal: 260, protein: 7, carbs: 42, allergens: "gluten, dairy", orders: 1420 }],
    ["breads-rice", "Laccha Paratha", 75, "veg", 0, 9, "Layered whole wheat paratha, crisp at the edges", { cal: 300, protein: 8, carbs: 46, allergens: "gluten", orders: 780 }],
    ["breads-rice", "Tandoori Roti", 35, "veg", 0, 6, "Plain whole wheat roti off the tandoor wall", { cal: 140, protein: 5, carbs: 28, allergens: "gluten", orders: 1650 }],
    ["breads-rice", "Hyderabadi Chicken Dum Biryani", 545, "nonveg", 3, 35, "Sealed and cooked on dum with long grain rice, served with raita and salan", { variants: [["Half", 340], ["Full", 545]], addons: [["Extra Raita", 45], ["Mirchi Ka Salan", 55]], cal: 780, protein: 40, carbs: 92, method: "Dum cooked", ingredients: "Basmati rice, chicken, curd, saffron, fried onion", allergens: "dairy, nuts", featured: true, chef: true, orders: 866 }],
    ["breads-rice", "Subz Dum Biryani", 425, "veg", 2, 30, "Vegetables and paneer layered with saffron rice and sealed with dough", { variants: [["Half", 275], ["Full", 425]], addons: [["Extra Raita", 45]], cal: 690, protein: 18, carbs: 96, allergens: "dairy, nuts", orders: 342 }],
    ["breads-rice", "Jeera Rice", 185, "veg", 0, 12, "Basmati tempered with cumin and ghee", { cal: 320, protein: 6, carbs: 62, allergens: "dairy", orders: 512 }],
    ["desserts", "Gulab Jamun", 120, "veg", 0, 5, "Two khoya dumplings in warm cardamom syrup", { cal: 340, protein: 5, carbs: 58, allergens: "dairy, gluten", orders: 604 }],
    ["desserts", "Shahi Tukda", 165, "veg", 0, 8, "Fried bread in saffron rabdi, topped with pistachio", { cal: 420, protein: 8, carbs: 54, allergens: "dairy, gluten, nuts", featured: true, orders: 288 }],
    ["desserts", "Kesar Pista Kulfi", 145, "veg", 0, 3, "Dense saffron and pistachio kulfi on a stick", { cal: 260, protein: 7, carbs: 32, allergens: "dairy, nuts", orders: 397 }],
    ["beverages", "Sweet Lassi", 175, "veg", 0, 5, "Thick curd blended with sugar and a little rose water", { variants: [["Regular", 125], ["Large", 175]], cal: 240, protein: 9, carbs: 36, allergens: "dairy", orders: 466 }],
    ["beverages", "Masala Chaas", 85, "veg", 0, 4, "Buttermilk with roasted cumin, curry leaf and green chilli", { cal: 70, protein: 4, carbs: 8, allergens: "dairy", orders: 351 }],
    ["beverages", "Fresh Lime Soda", 95, "veg", 0, 3, "Sweet, salted or mixed, made at the counter", { cal: 60, carbs: 15, orders: 428 }],
  ],
  "meghdoot-residency": [
    ["all-day-dining", "Poha Jalebi Platter", 145, "veg", 1, 12, "Indori poha with sev and a pair of hot jalebi on the side", { cal: 420, protein: 8, carbs: 68, allergens: "gluten", orders: 388 }],
    ["all-day-dining", "Masala Omelette with Toast", 185, "egg", 2, 10, "Three-egg omelette with onion, coriander and green chilli, buttered toast", { addons: [["Extra Egg", 45], ["Cheese Slice", 40]], cal: 460, protein: 24, carbs: 30, allergens: "egg, gluten, dairy", orders: 311 }],
    ["all-day-dining", "Aloo Pyaz Paratha with Curd", 165, "veg", 1, 15, "Two stuffed parathas with white butter, curd and mango pickle", { cal: 540, protein: 13, carbs: 72, allergens: "gluten, dairy", orders: 274 }],
    ["all-day-dining", "Club Sandwich", 275, "nonveg", 1, 14, "Triple decker with chicken, egg, bacon and tomato, served with fries", { variants: [["Half", 165], ["Full", 275]], addons: [["Extra Cheese", 45]], cal: 620, protein: 32, carbs: 48, allergens: "gluten, egg, dairy", featured: true, orders: 296 }],
    ["all-day-dining", "Veg Hakka Noodles", 245, "veg", 2, 15, "Wok-tossed noodles with julienned vegetables and dark soy", { addons: [["Chilli Garlic Sauce", 30]], cal: 480, protein: 12, carbs: 74, allergens: "gluten, soy", orders: 219 }],
    ["rajasthani", "Dal Baati Churma", 385, "veg", 2, 28, "Three baati with panchmel dal, churma and a bowl of ghee", { addons: [["Extra Baati", 60], ["Extra Ghee", 40]], cal: 880, protein: 22, carbs: 112, method: "Wood-fired baati", ingredients: "Wheat flour, panchmel dal, ghee, jaggery", allergens: "gluten, dairy", featured: true, chef: true, orders: 542 }],
    ["rajasthani", "Laal Maas", 625, "nonveg", 4, 34, "Mutton on the bone in Mathania chilli, as fierce as it should be", { cal: 680, protein: 48, carbs: 10, allergens: "dairy", chef: true, orders: 318 }],
    ["rajasthani", "Ker Sangri", 295, "veg", 2, 20, "Desert berries and beans tempered with red chilli and asafoetida", { cal: 240, protein: 7, carbs: 26, orders: 156 }],
    ["rajasthani", "Gatte Ki Sabzi", 275, "veg", 2, 22, "Gram flour dumplings in a spiced curd gravy", { cal: 390, protein: 14, carbs: 42, allergens: "dairy", orders: 208 }],
    ["rajasthani", "Safed Maas", 645, "nonveg", 1, 36, "Mutton in a white gravy of curd, cashew and poppy seed", { cal: 700, protein: 47, carbs: 16, allergens: "dairy, nuts", orders: 124 }],
    ["rajasthani", "Bajre Ki Roti", 95, "veg", 0, 10, "Pearl millet roti with garlic chutney and white butter", { cal: 210, protein: 6, carbs: 36, allergens: "dairy", orders: 287 }],
    ["continental", "Grilled Chicken Steak", 585, "nonveg", 1, 26, "Breast fillet with herb butter, sauteed vegetables and mash", { addons: [["Extra Mash", 80], ["Pepper Sauce", 60]], cal: 620, protein: 52, carbs: 28, allergens: "dairy", featured: true, orders: 187 }],
    ["continental", "Penne Arrabbiata", 395, "veg", 2, 20, "Penne in a slow-cooked tomato and chilli sauce with basil", { addons: [["Grilled Chicken", 145], ["Extra Cheese", 70]], cal: 540, protein: 16, carbs: 78, allergens: "gluten, dairy", orders: 231 }],
    ["continental", "Vegetable Au Gratin", 365, "veg", 1, 24, "Vegetables baked under bechamel and cheddar", { cal: 520, protein: 18, carbs: 42, allergens: "dairy, gluten", orders: 143 }],
    ["continental", "Caesar Salad", 385, "veg", 0, 12, "Romaine, parmesan and garlic croutons in a classic dressing", { variants: [["Regular", 285], ["Large", 385]], addons: [["Grilled Chicken", 145]], cal: 320, protein: 12, carbs: 18, allergens: "dairy, gluten, egg", orders: 165 }],
    ["room-service", "Club Kathi Roll", 245, "nonveg", 2, 16, "Chicken tikka in an egg paratha with onion and mint, cut in two", { addons: [["Extra Egg", 45]], cal: 520, protein: 28, carbs: 46, allergens: "gluten, egg, dairy", orders: 274 }],
    ["room-service", "Chicken Clear Soup", 165, "nonveg", 1, 12, "Light broth with shredded chicken and spring onion", { cal: 120, protein: 14, carbs: 6, orders: 198 }],
    ["room-service", "Cream of Tomato Soup", 155, "veg", 0, 12, "Roasted tomato and basil, finished with cream and croutons", { cal: 210, protein: 5, carbs: 22, allergens: "dairy, gluten", orders: 246 }],
    ["room-service", "Masala French Fries", 185, "veg", 2, 10, "Hand-cut fries tossed in chaat masala and red chilli", { addons: [["Cheese Dip", 60]], cal: 420, protein: 5, carbs: 52, orders: 402 }],
    ["room-service", "Paneer Bhurji with Pav", 265, "veg", 2, 15, "Scrambled paneer with onion and tomato, two butter pav", { cal: 480, protein: 22, carbs: 44, allergens: "dairy, gluten", orders: 187 }],
    ["desserts", "Malai Ghevar", 185, "veg", 0, 6, "Ghevar soaked in rabdi, a Udaipur monsoon habit", { cal: 460, protein: 8, carbs: 62, allergens: "dairy, gluten, nuts", featured: true, orders: 214 }],
    ["desserts", "Chocolate Walnut Brownie", 245, "veg", 0, 8, "Warm brownie with vanilla ice cream and chocolate sauce", { addons: [["Extra Ice Cream Scoop", 70]], cal: 540, protein: 8, carbs: 64, allergens: "gluten, dairy, nuts", orders: 288 }],
    ["desserts", "Seasonal Fruit Platter", 225, "veg", 0, 8, "Whatever the Udaipur mandi had that morning, cut to order", { cal: 180, protein: 3, carbs: 42, orders: 121 }],
    ["beverages", "Masala Chai", 165, "veg", 0, 8, "Brewed with ginger and green cardamom, served in a pot for two", { cal: 140, protein: 4, carbs: 20, allergens: "dairy", orders: 612 }],
    ["beverages", "Cold Coffee with Ice Cream", 265, "veg", 0, 6, "Blended cold coffee topped with a scoop of vanilla", { variants: [["Regular", 195], ["Large", 265]], cal: 320, protein: 8, carbs: 42, allergens: "dairy", featured: true, orders: 358 }],
    ["beverages", "Fresh Watermelon Juice", 175, "veg", 0, 5, "Pressed to order, no sugar added", { cal: 90, carbs: 22, orders: 203 }],
  ],
  "bombay-bun-co": [
    ["coffee", "Filter Kaapi", 150, "veg", 0, 5, "Chicory blend decoction with hot milk, poured between tumbler and davara", { variants: [["Single", 110], ["Double", 150]], cal: 120, protein: 5, carbs: 14, allergens: "dairy", featured: true, orders: 892 }],
    ["coffee", "Cappuccino", 220, "veg", 0, 4, "Double shot of the house Chikmagalur roast under steamed milk", { variants: [["Regular", 180], ["Large", 220]], addons: [["Extra Shot", 50], ["Oat Milk", 40]], cal: 150, protein: 7, carbs: 12, allergens: "dairy", featured: true, orders: 1104 }],
    ["coffee", "Flat White", 190, "veg", 0, 4, "Ristretto shots and thin microfoam, served small", { addons: [["Oat Milk", 40]], cal: 130, protein: 7, carbs: 10, allergens: "dairy", orders: 486 }],
    ["coffee", "Cortado", 170, "veg", 0, 3, "Equal parts espresso and warm milk", { addons: [["Oat Milk", 40]], cal: 90, protein: 5, carbs: 7, orders: 261 }],
    ["coffee", "Masala Chai", 95, "veg", 0, 6, "Cutting or full, boiled with ginger and crushed cardamom", { variants: [["Cutting", 60], ["Full", 95]], cal: 110, protein: 3, carbs: 16, allergens: "dairy", orders: 1340 }],
    ["cold", "Cold Brew", 240, "veg", 0, 2, "Sixteen hours in cold water, served black over ice", { variants: [["Regular", 190], ["Large", 240]], addons: [["Tonic Top", 40], ["Oat Milk", 40]], cal: 15, carbs: 3, featured: true, orders: 574 }],
    ["cold", "Iced Latte", 200, "veg", 0, 4, "Espresso poured long over cold milk and ice", { addons: [["Oat Milk", 40], ["Hazelnut Syrup", 40]], cal: 160, protein: 7, carbs: 14, allergens: "dairy", orders: 618 }],
    ["cold", "Banana Date Shake", 215, "veg", 0, 5, "Banana, dates and milk, no added sugar", { cal: 320, protein: 10, carbs: 52, allergens: "dairy", orders: 244 }],
    ["cold", "Nimbu Pudina Cooler", 145, "veg", 0, 4, "Lime and mint pressed with a little black salt", { cal: 70, carbs: 17, orders: 366 }],
    ["bakes", "Butter Croissant", 140, "veg", 0, 2, "Laminated overnight, baked at six", { cal: 290, protein: 6, carbs: 30, allergens: "gluten, dairy", orders: 708 }],
    ["bakes", "Almond Croissant", 185, "veg", 0, 2, "Yesterday's croissant, frangipane and toasted flakes", { cal: 420, protein: 9, carbs: 38, allergens: "gluten, dairy, nuts", featured: true, orders: 391 }],
    ["bakes", "Mawa Bun Maska", 95, "veg", 0, 3, "Split bun, cold Amul butter, mawa crumb", { cal: 310, protein: 7, carbs: 42, allergens: "gluten, dairy", featured: true, orders: 986 }],
    ["bakes", "Chilli Cheese Toastie", 195, "veg", 2, 8, "Cheddar, green chilli and coriander pressed on sourdough", { addons: [["Extra Cheese", 45]], cal: 420, protein: 18, carbs: 38, allergens: "gluten, dairy", orders: 432 }],
    ["bakes", "Rosemary Focaccia", 165, "veg", 0, 4, "Sea salt and rosemary, olive oil on the side", { cal: 300, protein: 7, carbs: 44, allergens: "gluten", orders: 218 }],
    ["breakfast", "Akuri on Sourdough", 285, "egg", 2, 12, "Parsi scrambled eggs with ginger, chilli and coriander on toast", { addons: [["Extra Egg", 45]], cal: 480, protein: 24, carbs: 36, allergens: "egg, gluten, dairy", featured: true, chef: true, orders: 447 }],
    ["breakfast", "Bun Maska with Omelette", 225, "egg", 1, 10, "Two-egg omelette in a buttered bun, cut in half", { cal: 440, protein: 20, carbs: 40, allergens: "egg, gluten, dairy", orders: 383 }],
    ["breakfast", "Poha with Sev", 125, "veg", 1, 8, "Flattened rice with peanuts, curry leaf and a squeeze of lime", { cal: 320, protein: 7, carbs: 54, allergens: "nuts", orders: 512 }],
    ["breakfast", "Avocado Toast with Poached Egg", 395, "egg", 1, 14, "Smashed avocado, chilli flakes and one poached egg on sourdough", { variants: [["One Egg", 345], ["Two Eggs", 395]], cal: 460, protein: 18, carbs: 34, allergens: "egg, gluten", orders: 289 }],
    ["sandwiches", "Bombay Sandwich", 175, "veg", 1, 9, "Potato, beetroot, cucumber and chutney, pressed on the griddle", { addons: [["Extra Cheese", 45]], cal: 380, protein: 10, carbs: 52, allergens: "gluten, dairy", orders: 623 }],
    ["sandwiches", "Chicken Tikka Roll", 265, "nonveg", 2, 12, "Tikka, onion and mint mayo rolled in a flaky paratha", { variants: [["Half", 165], ["Full", 265]], addons: [["Extra Cheese", 45]], cal: 520, protein: 30, carbs: 44, allergens: "gluten, dairy", featured: true, orders: 476 }],
    ["sandwiches", "Paneer Kathi Roll", 235, "veg", 2, 12, "Achari paneer with pickled onion in an egg-free paratha", { variants: [["Half", 145], ["Full", 235]], cal: 490, protein: 20, carbs: 46, allergens: "gluten, dairy", orders: 358 }],
    ["desserts", "Mango Cheesecake", 265, "veg", 0, 3, "Baked cheesecake with Alphonso puree, only while the season lasts", { cal: 440, protein: 9, carbs: 46, allergens: "dairy, gluten, egg", featured: true, orders: 267 }],
    ["desserts", "Sea Salt Chocolate Cookie", 120, "veg", 0, 2, "Dark chocolate, browned butter, flaky salt on top", { cal: 280, protein: 4, carbs: 34, allergens: "gluten, dairy, egg", orders: 741 }],
    ["desserts", "Sitaphal Ice Cream", 175, "veg", 0, 3, "Custard apple churned with cream, seeds and all picked out by hand", { cal: 260, protein: 5, carbs: 32, allergens: "dairy", orders: 204 }],
  ],
};

// ===========================================================================
// Floor plan
// ===========================================================================

const AREAS = {
  "kesar-kitchen": [
    ["Ground Floor", "indoor", "#f97316"],
    ["AC Hall", "indoor", "#0ea5e9"],
    ["Terrace", "outdoor", "#22c55e"],
    ["Private", "private", "#a855f7"],
  ],
  "meghdoot-residency": [
    ["Ground Floor", "indoor", "#0f766e"],
    ["AC Hall", "indoor", "#0ea5e9"],
    ["Terrace", "outdoor", "#22c55e"],
    ["Private", "private", "#a855f7"],
  ],
  "bombay-bun-co": [
    ["Ground Floor", "indoor", "#7c2d12"],
    ["Terrace", "outdoor", "#22c55e"],
  ],
};

// [name, area, capacity, type, status, guests, customer, waiter, occupiedMinsAgo]
const TABLES = {
  "kesar-kitchen": [
    ["G-1", "Ground Floor", 2, "2_seater", "free"],
    ["G-2", "Ground Floor", 4, "4_seater", "occupied", 3, "Rohit Malviya", "Imran Qureshi", 28],
    ["G-3", "Ground Floor", 4, "4_seater", "free"],
    ["G-4", "Ground Floor", 6, "6_seater", "occupied", 5, "Sneha Bhandari", "Deepa Nair", 52],
    ["G-5", "Ground Floor", 2, "couple", "reserved"],
    ["AC-1", "AC Hall", 4, "4_seater", "free"],
    ["AC-2", "AC Hall", 4, "4_seater", "occupied", 4, "Praveen Chouhan", "Imran Qureshi", 15],
    ["AC-3", "AC Hall", 6, "6_seater", "free"],
    ["AC-4", "AC Hall", 8, "family", "billing", 7, "Anand Trivedi", "Deepa Nair", 96],
    ["TR-1", "Terrace", 4, "open_terrace", "free"],
    ["TR-2", "Terrace", 4, "open_terrace", "occupied", 2, "Farhan Sheikh", "Imran Qureshi", 41],
    ["TR-3", "Terrace", 6, "open_terrace", "cleaning"],
    ["PR-1", "Private", 10, "banquet", "free"],
    ["PR-2", "Private", 12, "banquet", "reserved"],
  ],
  "meghdoot-residency": [
    ["G-1", "Ground Floor", 2, "2_seater", "free"],
    ["G-2", "Ground Floor", 4, "4_seater", "occupied", 2, "Ashwin Menon", "Pooja Rathi", 34],
    ["G-3", "Ground Floor", 4, "4_seater", "free"],
    ["AC-1", "AC Hall", 4, "4_seater", "free"],
    ["AC-2", "AC Hall", 6, "6_seater", "occupied", 6, "Kavita Bhatnagar", "Girdhari Lal", 62],
    ["AC-3", "AC Hall", 4, "4_seater", "free"],
    ["TR-1", "Terrace", 4, "open_terrace", "occupied", 4, "Sanjay Kothari", "Pooja Rathi", 18],
    ["TR-2", "Terrace", 4, "open_terrace", "free"],
    ["TR-3", "Terrace", 2, "couple", "reserved"],
    ["PR-1", "Private", 14, "banquet", "blocked"],
  ],
  "bombay-bun-co": [
    ["G-1", "Ground Floor", 2, "2_seater", "occupied", 2, "Ira Sathe", "Aditya Gawde", 22],
    ["G-2", "Ground Floor", 2, "2_seater", "free"],
    ["G-3", "Ground Floor", 4, "4_seater", "occupied", 3, "Nikhil Barve", "Aditya Gawde", 47],
    ["G-4", "Ground Floor", 2, "bar", "free"],
    ["G-5", "Ground Floor", 2, "bar", "free"],
    ["TR-1", "Terrace", 2, "open_terrace", "occupied", 2, "Zoya Merchant", "Aditya Gawde", 9],
    ["TR-2", "Terrace", 4, "open_terrace", "free"],
    ["TR-3", "Terrace", 2, "open_terrace", "cleaning"],
  ],
};

// ===========================================================================
// Stock and recipes. Recipe names match menu item names exactly — that is how
// lib/stock-consumption.ts ties a sale to the ingredients it should draw down.
// ===========================================================================

// [name, category, unit, stock, min, costPerUnit, supplier, location]
const INVENTORY = {
  "kesar-kitchen": [
    ["Basmati Rice", "Grains", "kg", 84, 25, 118, "Malwa Agro Traders", "Dry Store"],
    ["Urad Dal Whole", "Pulses", "kg", 38, 12, 142, "Malwa Agro Traders", "Dry Store"],
    ["Refined Flour", "Grains", "kg", 46, 15, 46, "Malwa Agro Traders", "Dry Store"],
    ["Whole Wheat Atta", "Grains", "kg", 62, 20, 42, "Malwa Agro Traders", "Dry Store"],
    ["Paneer", "Dairy", "kg", 9.5, 6, 340, "Sanchi Dairy Depot", "Cold Room"],
    ["Amul Butter", "Dairy", "kg", 14, 4, 545, "Sanchi Dairy Depot", "Cold Room"],
    ["Fresh Cream", "Dairy", "ltr", 11, 4, 210, "Sanchi Dairy Depot", "Cold Room"],
    ["Curd", "Dairy", "kg", 22, 8, 82, "Sanchi Dairy Depot", "Cold Room"],
    ["Desi Ghee", "Dairy", "kg", 13, 5, 620, "Sanchi Dairy Depot", "Dry Store"],
    ["Chicken Curd Cut", "Meat", "kg", 27, 10, 265, "Indore Poultry Supply", "Freezer"],
    ["Mutton Shoulder", "Meat", "kg", 7.5, 8, 720, "Sarafa Meat House", "Freezer"],
    ["Prawns Peeled", "Seafood", "kg", 4, 3, 890, "Sarafa Meat House", "Freezer"],
    ["Tomato", "Vegetables", "kg", 34, 12, 34, "Chhawni Mandi", "Vegetable Rack"],
    ["Onion", "Vegetables", "kg", 58, 20, 28, "Chhawni Mandi", "Vegetable Rack"],
    ["Ginger Garlic Paste", "Condiments", "kg", 6, 3, 180, "Chhawni Mandi", "Cold Room"],
    ["Cashew Whole", "Dry Fruits", "kg", 5.2, 3, 880, "Ratlam Spice Co", "Dry Store"],
    ["Kashmiri Chilli Powder", "Spices", "kg", 4.5, 2, 420, "Ratlam Spice Co", "Spice Rack"],
    ["Garam Masala", "Spices", "kg", 2.4, 1.5, 690, "Ratlam Spice Co", "Spice Rack"],
    ["Saffron", "Spices", "g", 145, 40, 42, "Ratlam Spice Co", "Locker"],
    ["Mustard Oil", "Oils", "ltr", 26, 10, 158, "Malwa Agro Traders", "Dry Store"],
    ["Sunflower Oil", "Oils", "ltr", 41, 15, 132, "Malwa Agro Traders", "Dry Store"],
  ],
  "meghdoot-residency": [
    ["Basmati Rice", "Grains", "kg", 66, 25, 118, "Mewar Provisions", "Dry Store"],
    ["Wheat Flour", "Grains", "kg", 74, 25, 44, "Mewar Provisions", "Dry Store"],
    ["Bajra Flour", "Grains", "kg", 18, 8, 58, "Mewar Provisions", "Dry Store"],
    ["Gram Flour", "Grains", "kg", 21, 8, 96, "Mewar Provisions", "Dry Store"],
    ["Panchmel Dal Mix", "Pulses", "kg", 26, 10, 138, "Mewar Provisions", "Dry Store"],
    ["Desi Ghee", "Dairy", "kg", 19, 6, 620, "Aravali Dairy", "Dry Store"],
    ["Curd", "Dairy", "kg", 28, 10, 82, "Aravali Dairy", "Cold Room"],
    ["Fresh Cream", "Dairy", "ltr", 14, 5, 210, "Aravali Dairy", "Cold Room"],
    ["Cheddar Cheese", "Dairy", "kg", 6, 3, 640, "Aravali Dairy", "Cold Room"],
    ["Eggs", "Dairy", "dozen", 34, 15, 84, "Aravali Dairy", "Cold Room"],
    ["Mutton Shoulder", "Meat", "kg", 11, 8, 720, "Udaipur Meat Mart", "Freezer"],
    ["Chicken Breast", "Meat", "kg", 16, 8, 310, "Udaipur Meat Mart", "Freezer"],
    ["Tomato", "Vegetables", "kg", 29, 12, 34, "Fatehpura Sabzi Mandi", "Vegetable Rack"],
    ["Onion", "Vegetables", "kg", 48, 20, 28, "Fatehpura Sabzi Mandi", "Vegetable Rack"],
    ["Potato", "Vegetables", "kg", 52, 20, 26, "Fatehpura Sabzi Mandi", "Vegetable Rack"],
    ["Mathania Chilli", "Spices", "kg", 3.1, 2, 780, "Jodhpur Masala Bhandar", "Spice Rack"],
    ["Coffee Beans", "Beverages", "kg", 7, 4, 1150, "Mewar Provisions", "Dry Store"],
    ["Tea Leaves CTC", "Beverages", "kg", 9, 4, 420, "Mewar Provisions", "Dry Store"],
  ],
  "bombay-bun-co": [
    ["Arabica Beans Chikmagalur", "Coffee", "kg", 12.5, 6, 1450, "Kaapi Roasters Bandra", "Roastery Shelf"],
    ["Chicory Blend", "Coffee", "kg", 4.2, 2, 620, "Kaapi Roasters Bandra", "Roastery Shelf"],
    ["Full Cream Milk", "Dairy", "ltr", 46, 25, 68, "Pali Dairy", "Cold Room"],
    ["Oat Milk", "Dairy", "ltr", 8, 6, 210, "Pali Dairy", "Cold Room"],
    ["Amul Butter", "Dairy", "kg", 9, 4, 545, "Pali Dairy", "Cold Room"],
    ["Cheddar Cheese", "Dairy", "kg", 5.5, 3, 640, "Pali Dairy", "Cold Room"],
    ["Eggs", "Dairy", "dozen", 28, 15, 84, "Pali Dairy", "Cold Room"],
    ["Bread Flour", "Bakery", "kg", 38, 15, 78, "Hill Road Baking Supplies", "Dry Store"],
    ["Sourdough Starter", "Bakery", "kg", 3, 1, 0, "Hill Road Baking Supplies", "Cold Room"],
    ["Laminating Butter", "Bakery", "kg", 6.5, 4, 720, "Hill Road Baking Supplies", "Cold Room"],
    ["Dark Chocolate 55%", "Bakery", "kg", 4.5, 3, 880, "Hill Road Baking Supplies", "Dry Store"],
    ["Almond Flakes", "Bakery", "kg", 2.1, 1.5, 1080, "Hill Road Baking Supplies", "Dry Store"],
    ["Potato", "Vegetables", "kg", 18, 8, 26, "Pali Naka Mandi", "Vegetable Rack"],
    ["Avocado", "Vegetables", "kg", 5, 4, 480, "Pali Naka Mandi", "Cold Room"],
    ["Chicken Tikka Cooked", "Meat", "kg", 6, 4, 420, "Bandra Cold Cuts", "Freezer"],
  ],
};

// recipeName -> [category, servings, prepMinutes, [[ingredientName, qty, unit], ...]]
const RECIPES = {
  "kesar-kitchen": {
    "Paneer Butter Masala": ["Main Course", 1, 20, [["Paneer", 0.2, "kg"], ["Tomato", 0.25, "kg"], ["Amul Butter", 0.03, "kg"], ["Fresh Cream", 0.04, "ltr"], ["Cashew Whole", 0.02, "kg"]]],
    "Murgh Makhani": ["Main Course", 1, 24, [["Chicken Curd Cut", 0.25, "kg"], ["Tomato", 0.3, "kg"], ["Amul Butter", 0.04, "kg"], ["Fresh Cream", 0.05, "ltr"], ["Cashew Whole", 0.02, "kg"]]],
    "Dal Kesar": ["Main Course", 1, 24, [["Urad Dal Whole", 0.12, "kg"], ["Amul Butter", 0.03, "kg"], ["Fresh Cream", 0.03, "ltr"], ["Tomato", 0.08, "kg"]]],
    "Hyderabadi Chicken Dum Biryani": ["Rice", 1, 35, [["Basmati Rice", 0.22, "kg"], ["Chicken Curd Cut", 0.28, "kg"], ["Curd", 0.08, "kg"], ["Desi Ghee", 0.03, "kg"], ["Onion", 0.15, "kg"], ["Saffron", 0.1, "g"]]],
    "Laal Maas": ["Main Course", 1, 32, [["Mutton Shoulder", 0.3, "kg"], ["Mustard Oil", 0.05, "ltr"], ["Kashmiri Chilli Powder", 0.02, "kg"], ["Onion", 0.12, "kg"], ["Curd", 0.06, "kg"]]],
    "Butter Naan": ["Breads", 1, 8, [["Refined Flour", 0.12, "kg"], ["Amul Butter", 0.015, "kg"], ["Curd", 0.02, "kg"]]],
    "Tandoori Roti": ["Breads", 1, 6, [["Whole Wheat Atta", 0.1, "kg"]]],
    "Paneer Tikka Lasooni": ["Starters", 1, 18, [["Paneer", 0.18, "kg"], ["Curd", 0.06, "kg"], ["Ginger Garlic Paste", 0.015, "kg"]]],
    "Jeera Rice": ["Rice", 1, 12, [["Basmati Rice", 0.15, "kg"], ["Desi Ghee", 0.02, "kg"]]],
    "Sweet Lassi": ["Beverages", 1, 5, [["Curd", 0.25, "kg"]]],
    "Achari Jhinga": ["Starters", 1, 20, [["Prawns Peeled", 0.2, "kg"], ["Curd", 0.05, "kg"], ["Mustard Oil", 0.02, "ltr"]]],
  },
  "meghdoot-residency": {
    "Dal Baati Churma": ["Rajasthani", 1, 28, [["Wheat Flour", 0.25, "kg"], ["Panchmel Dal Mix", 0.1, "kg"], ["Desi Ghee", 0.06, "kg"]]],
    "Laal Maas": ["Rajasthani", 1, 34, [["Mutton Shoulder", 0.32, "kg"], ["Mathania Chilli", 0.02, "kg"], ["Onion", 0.12, "kg"], ["Curd", 0.06, "kg"]]],
    "Gatte Ki Sabzi": ["Rajasthani", 1, 22, [["Gram Flour", 0.12, "kg"], ["Curd", 0.15, "kg"], ["Desi Ghee", 0.02, "kg"]]],
    "Bajre Ki Roti": ["Rajasthani", 1, 10, [["Bajra Flour", 0.1, "kg"], ["Desi Ghee", 0.01, "kg"]]],
    "Masala Omelette with Toast": ["All Day Dining", 1, 10, [["Eggs", 0.25, "dozen"], ["Onion", 0.05, "kg"], ["Wheat Flour", 0.06, "kg"]]],
    "Grilled Chicken Steak": ["Continental", 1, 26, [["Chicken Breast", 0.24, "kg"], ["Potato", 0.18, "kg"], ["Fresh Cream", 0.04, "ltr"]]],
    "Cream of Tomato Soup": ["Soups", 1, 12, [["Tomato", 0.25, "kg"], ["Fresh Cream", 0.03, "ltr"]]],
    "Masala Chai": ["Beverages", 2, 8, [["Tea Leaves CTC", 0.012, "kg"]]],
  },
  "bombay-bun-co": {
    Cappuccino: ["Coffee", 1, 4, [["Arabica Beans Chikmagalur", 0.018, "kg"], ["Full Cream Milk", 0.18, "ltr"]]],
    "Filter Kaapi": ["Coffee", 1, 5, [["Chicory Blend", 0.015, "kg"], ["Full Cream Milk", 0.15, "ltr"]]],
    "Cold Brew": ["Coffee", 1, 2, [["Arabica Beans Chikmagalur", 0.03, "kg"]]],
    "Butter Croissant": ["Bakery", 1, 2, [["Bread Flour", 0.08, "kg"], ["Laminating Butter", 0.045, "kg"]]],
    "Almond Croissant": ["Bakery", 1, 2, [["Bread Flour", 0.08, "kg"], ["Laminating Butter", 0.045, "kg"], ["Almond Flakes", 0.02, "kg"]]],
    "Mawa Bun Maska": ["Bakery", 1, 3, [["Bread Flour", 0.07, "kg"], ["Amul Butter", 0.02, "kg"]]],
    "Akuri on Sourdough": ["Breakfast", 1, 12, [["Eggs", 0.25, "dozen"], ["Bread Flour", 0.07, "kg"], ["Amul Butter", 0.015, "kg"]]],
    "Chilli Cheese Toastie": ["Bakery", 1, 8, [["Bread Flour", 0.07, "kg"], ["Cheddar Cheese", 0.06, "kg"], ["Amul Butter", 0.012, "kg"]]],
    "Chicken Tikka Roll": ["Sandwiches", 1, 12, [["Chicken Tikka Cooked", 0.12, "kg"], ["Bread Flour", 0.08, "kg"]]],
  },
};

// ===========================================================================
// Hotel rooms (Meghdoot only)
// ===========================================================================

// [number, type, floor, status, guestName, guestPhone, nightsIn, nightsLeft]
const ROOMS = [
  ["101", "Deluxe", 1, "occupied", "Ashwin Menon", "9845110022", 2, 1],
  ["102", "Deluxe", 1, "available"],
  ["103", "Deluxe", 1, "cleaning"],
  ["104", "Superior", 1, "occupied", "Kavita Bhatnagar", "9930220133", 1, 3],
  ["105", "Superior", 1, "available"],
  ["201", "Lake View", 2, "occupied", "Sanjay Kothari", "9822330244", 4, 2],
  ["202", "Lake View", 2, "occupied", "Elena Fischer", "9711440355", 1, 5],
  ["203", "Lake View", 2, "available"],
  ["204", "Superior", 2, "maintenance"],
  ["205", "Superior", 2, "available"],
  ["301", "Suite", 3, "occupied", "Harpreet Gill", "9878550466", 3, 2],
  ["302", "Suite", 3, "available"],
];

// ===========================================================================
// Customers
// ===========================================================================

// [name, phone, email, totalOrders, totalSpend, points, segment, vip]
const CUSTOMERS = {
  "kesar-kitchen": [
    ["Rohit Malviya", "9826450011", "rohit.malviya@gmail.com", 24, 41200, 412, "vip", true],
    ["Sneha Bhandari", "9826450012", "sneha.bhandari@gmail.com", 11, 18400, 184, "regular", false],
    ["Praveen Chouhan", "9826450013", "praveen.chouhan@outlook.com", 7, 9800, 98, "regular", false],
    ["Anand Trivedi", "9826450014", "anand.trivedi@gmail.com", 31, 68500, 685, "vip", true],
    ["Farhan Sheikh", "9826450015", "farhan.sheikh@gmail.com", 4, 5600, 56, "new", false],
    ["Meenakshi Sethi", "9826450016", "meenakshi.sethi@gmail.com", 15, 26300, 263, "regular", false],
    ["Sandeep Tomar", "9826450017", "sandeep.tomar@gmail.com", 2, 2400, 24, "new", false],
    ["Ruchi Agrawal", "9826450018", "ruchi.agrawal@gmail.com", 19, 33900, 339, "vip", false],
  ],
  "meghdoot-residency": [
    ["Ashwin Menon", "9845110022", "ashwin.menon@gmail.com", 9, 21400, 214, "regular", false],
    ["Kavita Bhatnagar", "9930220133", "kavita.b@gmail.com", 5, 14800, 148, "regular", false],
    ["Sanjay Kothari", "9822330244", "sanjay.kothari@gmail.com", 22, 78600, 786, "vip", true],
    ["Elena Fischer", "9711440355", "elena.fischer@gmail.com", 2, 8900, 89, "new", false],
    ["Harpreet Gill", "9878550466", "harpreet.gill@gmail.com", 13, 46200, 462, "vip", true],
    ["Nisha Ranawat", "9829660577", "nisha.ranawat@gmail.com", 6, 12300, 123, "regular", false],
  ],
  "bombay-bun-co": [
    ["Ira Sathe", "9820770011", "ira.sathe@gmail.com", 41, 18600, 186, "vip", true],
    ["Nikhil Barve", "9820770012", "nikhil.barve@gmail.com", 18, 7900, 79, "regular", false],
    ["Zoya Merchant", "9820770013", "zoya.merchant@gmail.com", 27, 11400, 114, "vip", false],
    ["Karan Vaidya", "9820770014", "karan.vaidya@gmail.com", 6, 2600, 26, "regular", false],
    ["Priyanka Salvi", "9820770015", "priyanka.salvi@gmail.com", 3, 1100, 11, "new", false],
  ],
};

// ===========================================================================
// Live orders — one per state the panels have a column for.
// { ref, d, h, type, status, table|room, cust, waiter, pay:[method,status], lines }
// A line is [dishName, qty, variantName?, [addonNames]?]
// ===========================================================================

const LIVE_ORDERS = {
  "kesar-kitchen": [
    { ref: "0231", d: 0, h: 20, m: 55, type: "dine_in", status: "new", table: "AC-2", cust: "Praveen Chouhan", lines: [["Paneer Tikka Lasooni", 1, "Full", ["Extra Mint Chutney"]], ["Butter Naan", 4], ["Dal Kesar", 1, "Full"]] },
    { ref: "0230", d: 0, h: 20, m: 32, type: "dine_in", status: "preparing", table: "G-2", cust: "Rohit Malviya", waiter: "Imran Qureshi", lines: [["Murgh Makhani", 1, "Full", ["Extra Gravy"]], ["Tandoori Roti", 5], ["Sweet Lassi", 2, "Large"]] },
    { ref: "0229", d: 0, h: 20, m: 10, type: "dine_in", status: "ready", table: "TR-2", cust: "Farhan Sheikh", waiter: "Imran Qureshi", lines: [["Tandoori Chicken", 1, "Half"], ["Laccha Paratha", 2]] },
    { ref: "0228", d: 0, h: 19, m: 40, type: "dine_in", status: "served", table: "G-4", cust: "Sneha Bhandari", waiter: "Deepa Nair", lines: [["Hyderabadi Chicken Dum Biryani", 2, "Full", ["Extra Raita", "Mirchi Ka Salan"]], ["Gulab Jamun", 2]] },
    { ref: "0227", d: 0, h: 18, m: 55, type: "dine_in", status: "billing", table: "AC-4", cust: "Anand Trivedi", waiter: "Deepa Nair", guests: 7, lines: [["Murgh Malai Tikka", 2, "Full"], ["Laal Maas", 1], ["Paneer Butter Masala", 1], ["Butter Naan", 8], ["Jeera Rice", 2], ["Shahi Tukda", 3]] },
    { ref: "0226", d: 0, h: 13, m: 20, type: "takeaway", status: "completed", cust: "Meenakshi Sethi", pay: ["upi", "paid"], lines: [["Subz Dum Biryani", 1, "Full", ["Extra Raita"]], ["Kesar Pista Kulfi", 2]] },
    { ref: "0225", d: 0, h: 13, m: 5, type: "delivery", status: "delivered", cust: "Sandeep Tomar", pay: ["card", "paid"], address: "302, Silver Sands Apartments, Vijay Nagar, Indore 452010", lines: [["Kadhai Chicken", 1, "Full"], ["Butter Naan", 4], ["Fresh Lime Soda", 2]] },
    { ref: "0224", d: 0, h: 12, m: 40, type: "dine_in", status: "cancelled", table: "G-3", cust: "Ruchi Agrawal", reason: "Guest could not wait for the tandoor", lines: [["Amritsari Fish Tikka", 1], ["Tandoori Roti", 3]] },
  ],
  "meghdoot-residency": [
    { ref: "0184", d: 0, h: 21, m: 15, type: "room_service", status: "new", room: "201", cust: "Sanjay Kothari", lines: [["Club Kathi Roll", 2, null, ["Extra Egg"]], ["Masala Chai", 1]] },
    { ref: "0183", d: 0, h: 20, m: 50, type: "room_service", status: "preparing", room: "104", cust: "Kavita Bhatnagar", lines: [["Cream of Tomato Soup", 2], ["Masala French Fries", 1, null, ["Cheese Dip"]]] },
    { ref: "0182", d: 0, h: 20, m: 20, type: "dine_in", status: "ready", table: "AC-2", cust: "Kavita Bhatnagar", waiter: "Girdhari Lal", guests: 6, lines: [["Dal Baati Churma", 3, null, ["Extra Ghee"]], ["Ker Sangri", 1], ["Bajre Ki Roti", 4]] },
    { ref: "0181", d: 0, h: 19, m: 45, type: "dine_in", status: "served", table: "TR-1", cust: "Sanjay Kothari", waiter: "Pooja Rathi", lines: [["Laal Maas", 1], ["Safed Maas", 1], ["Bajre Ki Roti", 6]] },
    { ref: "0180", d: 0, h: 19, m: 5, type: "dine_in", status: "billing", table: "G-2", cust: "Ashwin Menon", waiter: "Pooja Rathi", lines: [["Grilled Chicken Steak", 1, null, ["Pepper Sauce"]], ["Caesar Salad", 1, "Large", ["Grilled Chicken"]], ["Cold Coffee with Ice Cream", 2, "Large"]] },
    { ref: "0179", d: 0, h: 8, m: 30, type: "room_service", status: "completed", room: "202", cust: "Elena Fischer", pay: ["room_bill", "paid"], lines: [["Masala Omelette with Toast", 1, null, ["Cheese Slice"]], ["Masala Chai", 1], ["Seasonal Fruit Platter", 1]] },
    { ref: "0178", d: 0, h: 9, m: 10, type: "room_service", status: "completed", room: "301", cust: "Harpreet Gill", pay: ["room_bill", "paid"], lines: [["Poha Jalebi Platter", 2], ["Masala Chai", 1]] },
    { ref: "0177", d: 0, h: 14, m: 25, type: "takeaway", status: "cancelled", cust: "Nisha Ranawat", reason: "Guest checked out earlier than planned", lines: [["Penne Arrabbiata", 1, null, ["Grilled Chicken"]]] },
  ],
  "bombay-bun-co": [
    { ref: "0417", d: 0, h: 11, m: 20, type: "dine_in", status: "new", table: "TR-1", cust: "Zoya Merchant", lines: [["Cold Brew", 1, "Large", ["Tonic Top"]], ["Almond Croissant", 1]] },
    { ref: "0416", d: 0, h: 11, m: 5, type: "dine_in", status: "preparing", table: "G-1", cust: "Ira Sathe", waiter: "Aditya Gawde", lines: [["Akuri on Sourdough", 1, null, ["Extra Egg"]], ["Filter Kaapi", 1, "Double"]] },
    { ref: "0415", d: 0, h: 10, m: 45, type: "dine_in", status: "ready", table: "G-3", cust: "Nikhil Barve", waiter: "Aditya Gawde", lines: [["Cappuccino", 2, "Large", ["Oat Milk"]], ["Chilli Cheese Toastie", 1, null, ["Extra Cheese"]]] },
    { ref: "0414", d: 0, h: 10, m: 10, type: "dine_in", status: "served", table: "G-3", cust: "Nikhil Barve", waiter: "Aditya Gawde", lines: [["Mawa Bun Maska", 2], ["Masala Chai", 2, "Cutting"]] },
    { ref: "0413", d: 0, h: 9, m: 40, type: "takeaway", status: "completed", cust: "Karan Vaidya", pay: ["upi", "paid"], lines: [["Bombay Sandwich", 1, null, ["Extra Cheese"]], ["Nimbu Pudina Cooler", 1]] },
    { ref: "0412", d: 0, h: 9, m: 15, type: "delivery", status: "delivered", cust: "Priyanka Salvi", pay: ["upi", "paid"], address: "14B, Rizvi Park, Off Carter Road, Bandra West, Mumbai 400050", lines: [["Chicken Tikka Roll", 2, "Full"], ["Sea Salt Chocolate Cookie", 2]] },
    { ref: "0411", d: 0, h: 8, m: 50, type: "takeaway", status: "cancelled", cust: "Ira Sathe", reason: "Card declined at the counter", lines: [["Iced Latte", 1, null, ["Hazelnut Syrup"]]] },
    { ref: "0410", d: 0, h: 8, m: 20, type: "dine_in", status: "billing", table: "TR-1", cust: "Zoya Merchant", waiter: "Aditya Gawde", lines: [["Avocado Toast with Poached Egg", 1, "Two Eggs"], ["Flat White", 1, null, ["Oat Milk"]]] },
  ],
};

/** Baskets the history generator draws from, so past days look like the menu actually sells. */
const HISTORY_BASKETS = {
  "kesar-kitchen": [
    [["Murgh Makhani", 1, "Full"], ["Butter Naan", 4], ["Jeera Rice", 1]],
    [["Paneer Butter Masala", 1], ["Tandoori Roti", 4], ["Sweet Lassi", 2, "Regular"]],
    [["Hyderabadi Chicken Dum Biryani", 2, "Full", ["Extra Raita"]], ["Gulab Jamun", 2]],
    [["Tandoori Chicken", 1, "Full"], ["Laccha Paratha", 3], ["Masala Chaas", 2]],
    [["Dal Kesar", 1, "Full", ["Extra Butter"]], ["Butter Naan", 3], ["Kesar Pista Kulfi", 1]],
    [["Laal Maas", 1], ["Tandoori Roti", 5], ["Fresh Lime Soda", 2]],
    [["Paneer Tikka Lasooni", 1, "Half"], ["Chilli Paneer Dry", 1], ["Subz Dum Biryani", 1, "Half"]],
    [["Kadhai Chicken", 1, "Half"], ["Malai Kofta", 1], ["Butter Naan", 4], ["Shahi Tukda", 2]],
    [["Murgh Malai Tikka", 1, "Full"], ["Rogan Josh", 1], ["Jeera Rice", 2]],
    [["Egg Curry Dhaba Style", 1], ["Tandoori Roti", 4], ["Masala Chaas", 1]],
  ],
  "meghdoot-residency": [
    [["Dal Baati Churma", 2, null, ["Extra Ghee"]], ["Masala Chai", 1]],
    [["Laal Maas", 1], ["Bajre Ki Roti", 4], ["Fresh Watermelon Juice", 2]],
    [["Club Sandwich", 1, "Full"], ["Cold Coffee with Ice Cream", 1, "Regular"]],
    [["Poha Jalebi Platter", 2], ["Masala Chai", 1]],
    [["Grilled Chicken Steak", 1], ["Caesar Salad", 1, "Regular"], ["Malai Ghevar", 1]],
    [["Penne Arrabbiata", 1, null, ["Extra Cheese"]], ["Cream of Tomato Soup", 1]],
    [["Gatte Ki Sabzi", 1], ["Ker Sangri", 1], ["Bajre Ki Roti", 6]],
    [["Masala Omelette with Toast", 2], ["Masala Chai", 1], ["Seasonal Fruit Platter", 1]],
    [["Club Kathi Roll", 2], ["Masala French Fries", 1], ["Chicken Clear Soup", 2]],
    [["Vegetable Au Gratin", 1], ["Chocolate Walnut Brownie", 1, null, ["Extra Ice Cream Scoop"]]],
  ],
  "bombay-bun-co": [
    [["Cappuccino", 2, "Regular"], ["Butter Croissant", 2]],
    [["Filter Kaapi", 1, "Double"], ["Mawa Bun Maska", 2]],
    [["Cold Brew", 1, "Large"], ["Sea Salt Chocolate Cookie", 2]],
    [["Akuri on Sourdough", 1], ["Iced Latte", 1, null, ["Oat Milk"]]],
    [["Chicken Tikka Roll", 1, "Full", ["Extra Cheese"]], ["Nimbu Pudina Cooler", 1]],
    [["Bombay Sandwich", 2], ["Masala Chai", 2, "Cutting"]],
    [["Avocado Toast with Poached Egg", 1, "One Egg"], ["Flat White", 1]],
    [["Chilli Cheese Toastie", 1], ["Banana Date Shake", 1]],
    [["Almond Croissant", 1], ["Cortado", 1]],
    [["Paneer Kathi Roll", 1, "Full"], ["Mango Cheesecake", 1], ["Cappuccino", 1, "Large"]],
  ],
};

// ===========================================================================
// Seeding
// ===========================================================================

const summary = { venues: [], logins: [], notes: [] };

async function seedVenue(v) {
  const pinHash = await bcrypt.hash(STAFF_PASSWORD, 10);

  const ownerUser = await ensure(
    "users",
    { email: v.owner.email },
    { name: v.owner.name, password_hash: pinHash, role: "restaurant_owner", is_email_verified: true, approval_status: "approved", approved_at: new Date(), approved_by: "platform" },
  );

  const restaurant = await ensure(
    "restaurants",
    { slug: v.slug },
    {
      user_id: ownerUser.id,
      name: v.name,
      description: v.description,
      address: v.address,
      phone: v.phone,
      email: v.email,
      website: v.website,
      currency: "INR",
      primary_color: v.primaryColor,
      business_type: v.businessType,
      timezone: "Asia/Kolkata",
      is_active: true,
      plan: v.plan,
      gst_number: v.gst,
      fssai_number: v.fssai,
      open_time: v.openTime,
      close_time: v.closeTime,
      // kyc approved + is_active is what makes the venue "Published", which is what the
      // analytics endpoints and the guest QR both check before returning anything real.
      settings: J({
        kyc: { status: "approved", verifiedOn: at(45, 11).toISOString() },
        billing: { taxPercent: 5, serviceChargePercent: 0, invoicePrefix: v.prefix, roundOff: true },
        profile: { cuisines: v.cuisines, seatingCapacity: (TABLES[v.slug] ?? []).reduce((s, t) => s + t[2], 0) },
        ordering: { dineIn: true, takeaway: true, delivery: v.businessType !== "hotel", roomService: v.businessType === "hotel" },
      }),
    },
  );
  const rid = restaurant.id;

  const branch = await ensure("branches", { restaurant_id: rid, name: v.branch.name }, { address: v.branch.address, phone: v.branch.phone, is_active: true });

  // --- staff ------------------------------------------------------------
  const staffByRole = {};
  const staffByName = {};
  for (const [name, local, role, phone, shift, salary] of STAFF[v.slug]) {
    const email = `${local}@${v.domain}`;
    const row = await ensure(
      "staff",
      { email },
      { restaurant_id: rid, name, role, phone, pin_hash: pinHash, salary: money(salary), shift, status: "active", is_active: true, join_date: at(200 + (salary % 90), 10), performance_score: 70 + (salary % 25) },
    );
    (staffByRole[role] ??= []).push(row);
    staffByName[name] = row;
    summary.logins.push({ venue: v.name, role, name, email });
  }

  // --- floor plan -------------------------------------------------------
  const areaIds = {};
  for (const [i, [name, type, colour]] of (AREAS[v.slug] ?? []).entries()) {
    const a = await ensure("table_areas", { restaurant_id: rid, name }, { area_type: type, color_code: colour, sort_order: i + 1, is_active: true });
    areaIds[name] = a.id;
  }

  const tableByName = {};
  for (const [i, t] of (TABLES[v.slug] ?? []).entries()) {
    const [name, zone, capacity, type, status, guests, customer, waiter, minsAgo] = t;
    const occupied = ["occupied", "billing"].includes(status);
    const row = await ensure(
      "tables_map",
      { restaurant_id: rid, name },
      {
        branch_id: branch.id,
        zone,
        area_id: areaIds[zone] ?? null,
        table_type: type,
        table_category: v.businessType === "hotel" ? "hotel_resort" : "restaurant",
        capacity,
        status,
        is_active: true,
        current_guest_count: occupied ? guests ?? 0 : 0,
        current_customer_name: occupied ? customer ?? null : null,
        current_waiter_name: occupied ? waiter ?? null : null,
        occupied_since: occupied && minsAgo ? new Date(Date.now() - minsAgo * 60000) : null,
        position_x: 80 + (i % 5) * 140,
        position_y: 90 + Math.floor(i / 5) * 130,
        qr_code_url: `/scan/${v.slug}?table=${encodeURIComponent(name)}&entry=qr`,
      },
    );
    tableByName[name] = row;

    await ensure(
      "qr_codes",
      { restaurant_id: rid, label: `Table ${name}` },
      { table_id: row.id, type: "table", url: `/scan/${v.slug}?table=${encodeURIComponent(name)}&entry=qr`, scans: 40 + ((i * 17) % 260) },
    );
  }

  // --- menu -------------------------------------------------------------
  const catIds = {};
  for (const [slug, name, group, sort] of CATEGORIES[v.slug]) {
    const c = await ensure("categories", { restaurant_id: rid, slug }, { name, category_group: group, sort_order: sort, is_available: true });
    catIds[slug] = c.id;
  }

  const itemByName = {};
  for (const [i, m] of MENU[v.slug].entries()) {
    const [cat, name, price, diet, spice, prep, desc, extra = {}] = m;
    const tags =
      diet === "veg" ? ["vegetarian"] : diet === "egg" ? ["egg", "non-veg"] : ["non-veg"];
    if (extra.glutenFree) tags.push("gluten-free");

    const row = await ensure(
      "menu_items",
      { restaurant_id: rid, name },
      {
        category_id: catIds[cat],
        description: desc,
        price: money(price),
        spice_level: spice,
        prep_time: prep,
        dietary_tags: tags,
        is_available: true,
        is_featured: !!extra.featured,
        chef_recommended: !!extra.chef,
        sort_order: i + 1,
        calories: extra.cal ?? null,
        protein: extra.protein ?? null,
        carbs: extra.carbs ?? null,
        prep_method: extra.method ?? null,
        ingredients: extra.ingredients ?? null,
        allergens: extra.allergens ?? "none",
        order_count: extra.orders ?? 0,
        view_count: (extra.orders ?? 0) * 3 + 40,
        // Objects, not bare strings: order-pricing matches on variants[].name and reads
        // variants[].price as the full price of that portion. A plain ["Half","Full"]
        // array — which is what the older seed writes — prices at the base rate instead.
        variants: J((extra.variants ?? []).map(([n, p]) => ({ name: n, price: p }))),
        addons: J((extra.addons ?? []).map(([n, p]) => ({ name: n, price: p }))),
        // Deliberately empty: whatever goes in here is offered to the guest as a paid
        // option, so a shared default set would sell "extra cheese" on a cup of coffee.
        customization_options: J({}),
      },
    );
    itemByName[name] = row;
  }

  // --- stock ------------------------------------------------------------
  const stockByName = {};
  for (const [name, category, unit, stock, min, cost, supplier, location] of INVENTORY[v.slug]) {
    const row = await ensure(
      "inventory_items",
      { restaurant_id: rid, name },
      { category, unit, current_stock: money(stock), min_stock: money(min), max_stock: money(min * 6), cost_per_unit: money(cost), supplier, location, is_active: true, last_updated: new Date() },
    );
    stockByName[name] = row;
  }

  for (const [name, [category, servings, prep, ingredients]] of Object.entries(RECIPES[v.slug])) {
    const menuItem = itemByName[name];
    let cost = 0;
    for (const [ing, qty] of ingredients) cost += qty * Number(stockByName[ing]?.cost_per_unit ?? 0);
    const sellingPrice = Number(menuItem?.price ?? 0);
    const recipe = await ensure(
      "recipes",
      { restaurant_id: rid, name },
      { category, servings, preparation_time: prep, selling_price: money(sellingPrice), total_cost: money(cost), profit_margin: money(sellingPrice > 0 ? ((sellingPrice - cost) / sellingPrice) * 100 : 0), instructions: null, is_active: true },
    );
    for (const [ing, qty, unit] of ingredients) {
      const stockRow = stockByName[ing];
      const unitCost = Number(stockRow?.cost_per_unit ?? 0);
      await ensure(
        "recipe_ingredients",
        { recipe_id: recipe.id, ingredient_name: ing },
        { restaurant_id: rid, quantity: String(qty), unit, cost_per_unit: money(unitCost), total_cost: money(qty * unitCost), inventory_item_id: stockRow?.id ?? null },
      );
    }
  }

  return { v, rid, branchId: branch.id, staffByRole, staffByName, tableByName, itemByName, stockByName };
}

/** Price a basket the way the server does, so a seeded bill and a live one agree. */
function priceLines(ctx, lines) {
  const items = [];
  let subtotal = 0;
  for (const [name, qty, variantName, addonNames] of lines) {
    const mi = ctx.itemByName[name];
    if (!mi) throw new Error(`${ctx.v.slug}: order references unknown dish "${name}"`);
    const variants = typeof mi.variants === "string" ? JSON.parse(mi.variants) : mi.variants ?? [];
    const offered = typeof mi.addons === "string" ? JSON.parse(mi.addons) : mi.addons ?? [];

    let unit = Number(mi.price);
    let variant = null;
    if (variantName) {
      const match = variants.find((x) => x.name === variantName);
      if (!match) throw new Error(`${ctx.v.slug}: "${name}" has no variant "${variantName}"`);
      unit = Number(match.price);
      variant = match.name;
    }
    const addons = [];
    for (const an of addonNames ?? []) {
      const match = offered.find((x) => x.name === an);
      if (!match) throw new Error(`${ctx.v.slug}: "${name}" has no addon "${an}"`);
      addons.push({ name: match.name, price: Number(match.price) });
      unit += Number(match.price);
    }
    const lineTotal = Math.round(unit * qty * 100) / 100;
    subtotal += lineTotal;
    items.push({ id: mi.id, menuItemId: mi.id, name: mi.name, price: unit, quantity: qty, variant, addons, course: "main", subtotal: lineTotal });
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  return { items, subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

const SETTLED = new Set(["completed", "delivered"]);

async function insertOrder(ctx, spec) {
  const { v, rid } = ctx;
  const priced = priceLines(ctx, spec.lines);
  const created = at(spec.d, spec.h, spec.m ?? 0);
  const invoice = `${v.prefix}/26/${spec.ref}`;
  const table = spec.table ? ctx.tableByName[spec.table] : null;
  const waiter = spec.waiter ? ctx.staffByName[spec.waiter] : null;
  const customer = (CUSTOMERS[v.slug] ?? []).find((c) => c[0] === spec.cust);
  const paid = SETTLED.has(spec.status) || spec.pay?.[1] === "paid";

  const order = await ensure(
    "orders",
    { restaurant_id: rid, invoice_number: invoice },
    {
      table_id: table?.id ?? null,
      table_name: spec.room ? `Room ${spec.room}` : spec.table ?? null,
      customer_name: spec.cust ?? null,
      customer_phone: customer?.[1] ?? null,
      customer_email: customer?.[2] ?? null,
      type: spec.type,
      status: spec.status,
      subtotal: money(priced.subtotal),
      tax: money(priced.tax),
      total: money(priced.total),
      discount_amount: money(0),
      service_charge: money(0),
      tip_amount: money(spec.tip ?? 0),
      delivery_address: spec.address ?? null,
      payment_method: paid ? spec.pay?.[0] ?? "cash" : null,
      payment_status: paid ? "paid" : "pending",
      order_source: spec.type === "room_service" ? "room_qr" : spec.type === "dine_in" ? "qr" : "counter",
      waiter_id: waiter?.id ?? null,
      waiter_name: waiter?.name ?? null,
      guest_count: spec.guests ?? (spec.type === "dine_in" ? 2 : 1),
      branch_id: ctx.branchId,
      cancelled_reason: spec.reason ?? null,
      notes: spec.notes ?? null,
      items: J(priced.items),
      metadata: J({ ...(spec.room ? { roomNumber: spec.room } : {}), seededWorld: true }),
      created_at: created,
      updated_at: created,
    },
  );

  if (paid) {
    await ensure(
      "finance_transactions",
      { restaurant_id: rid, reference: invoice },
      { type: "income", category: "Food Sales", description: `${spec.type.replace("_", " ")} bill ${invoice}`, amount: money(priced.total), payment_method: spec.pay?.[0] ?? "cash", order_id: order.id, performed_by: ctx.staffByRole.cashier?.[0]?.name ?? "Counter", date: created },
    );
  }
  return { order, priced };
}

async function seedOrders(ctx) {
  const { v, rid } = ctx;
  const placed = [];

  for (const spec of LIVE_ORDERS[v.slug]) placed.push(await insertOrder(ctx, spec));

  // A week of settled history so the dashboards, revenue charts and top-item lists have
  // something to plot. Deterministic: the same invoice numbers come back on every run.
  const rand = rng(v.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 7));
  const baskets = HISTORY_BASKETS[v.slug];
  const names = CUSTOMERS[v.slug].map((c) => c[0]);
  const tableNames = Object.keys(ctx.tableByName);
  const waiters = (ctx.staffByRole.waiter ?? []).map((s) => s.name);
  const methods = ["cash", "upi", "upi", "card", "upi"];
  const types = v.businessType === "hotel"
    ? ["dine_in", "dine_in", "room_service", "room_service", "takeaway"]
    : ["dine_in", "dine_in", "dine_in", "takeaway", "delivery"];

  let seq = 1000;
  for (let day = 1; day <= 7; day += 1) {
    const perDay = 4 + Math.floor(rand() * 3);
    for (let n = 0; n < perDay; n += 1) {
      seq += 1;
      const type = types[Math.floor(rand() * types.length)];
      const hour = v.businessType === "cafe" ? 8 + Math.floor(rand() * 12) : 12 + Math.floor(rand() * 10);
      const tableName = type === "dine_in" ? tableNames[Math.floor(rand() * tableNames.length)] : undefined;
      const roomNumber = type === "room_service" ? ROOMS[Math.floor(rand() * ROOMS.length)][0] : undefined;
      placed.push(
        await insertOrder(ctx, {
          ref: String(seq),
          d: day,
          h: hour,
          m: Math.floor(rand() * 60),
          type,
          status: type === "delivery" ? "delivered" : "completed",
          table: tableName,
          room: roomNumber,
          cust: names[Math.floor(rand() * names.length)],
          waiter: tableName ? waiters[Math.floor(rand() * waiters.length)] : undefined,
          pay: [methods[Math.floor(rand() * methods.length)], "paid"],
          address: type === "delivery" ? "Flat 4B, Sunrise Residency, near the market crossing" : undefined,
          lines: baskets[Math.floor(rand() * baskets.length)],
        }),
      );
    }
  }

  // Point the occupied tables at the round they are actually running.
  for (const spec of LIVE_ORDERS[v.slug]) {
    if (!spec.table || SETTLED.has(spec.status) || spec.status === "cancelled") continue;
    const t = ctx.tableByName[spec.table];
    const match = placed.find((p) => p.order.invoice_number === `${v.prefix}/26/${spec.ref}`);
    if (t && match) {
      await q(`update tables_map set current_order_id = $1 where id = $2`, [match.order.id, t.id]);
    }
  }

  return placed;
}

async function seedOperations(ctx, placed) {
  const { v, rid } = ctx;
  const hotel = v.businessType === "hotel";

  // --- customers --------------------------------------------------------
  for (const [name, phone, email, orders, spend, points, segment, vip] of CUSTOMERS[v.slug]) {
    await ensure(
      "customers",
      { restaurant_id: rid, phone },
      { name, email, total_orders: orders, total_spend: money(spend), loyalty_points: points, segment, is_vip: vip, last_visit: at(orders % 9, 20), wallet_balance: money(vip ? 500 : 0), preferences: J({ seating: vip ? "AC Hall" : "no preference" }), favorite_items: J([]) },
    );
  }
  await ensure("loyalty_programs", { restaurant_id: rid }, { is_enabled: true, type: "points", points_per_dollar: money(1), cashback_percent: money(2), stamps_for_reward: 10, reward_value: money(200), expiry_days: 365 });

  // --- hotel rooms ------------------------------------------------------
  if (hotel) {
    for (const [number, type, floor, status, guest, phone, nightsIn, nightsLeft] of ROOMS) {
      await ensure(
        "hotel_rooms",
        { restaurant_id: rid, number },
        { type, floor, status, guest_name: guest ?? null, guest_phone: phone ?? null, check_in: guest ? at(nightsIn, 14) : null, check_out: guest ? at(-nightsLeft, 11) : null, is_active: "true", room_controls: J({ ac: true, lights: true, doNotDisturb: false, curtains: true }) },
      );
    }
    for (const [room, guest, type, status, note] of [
      ["101", "Ashwin Menon", "amenities", "pending", "Two extra bath towels and a bottle of still water"],
      ["104", "Kavita Bhatnagar", "laundry", "in_progress", "Three shirts for same-day pressing"],
      ["201", "Sanjay Kothari", "maintenance", "pending", "Bathroom geyser slow to heat"],
      ["202", "Elena Fischer", "amenities", "completed", "Extra pillow and a hot water kettle"],
    ]) {
      await ensure(
        "room_service_requests",
        { restaurant_id: rid, room_number: room, guest_name: guest },
        { type, status, notes: note, total: money(0), assigned_to: "Sushila Devi", estimated_time: 20, completed_at: status === "completed" ? at(0, 9) : null, items: J([]), created_at: at(0, 8, 40) },
      );
    }
  }

  // --- reservations -----------------------------------------------------
  const reservations = hotel
    ? [
        ["Nisha Ranawat", "9829660577", 1, "20:00", 4, "confirmed", "Terrace table facing the lake if possible"],
        ["Vikram Dagar", "9829660588", 2, "13:30", 2, "pending", ""],
        ["Alka Songara", "9829660599", 3, "21:00", 8, "confirmed", "Anniversary dinner, cake at the end"],
        ["Rajeev Sisodia", "9829660510", 0, "19:30", 6, "seated", ""],
      ]
    : v.slug === "kesar-kitchen"
      ? [
          ["Meenakshi Sethi", "9826450016", 1, "20:30", 6, "confirmed", "Birthday, needs the private room"],
          ["Sandeep Tomar", "9826450017", 2, "13:00", 4, "pending", ""],
          ["Ruchi Agrawal", "9826450018", 0, "21:15", 2, "confirmed", "Window table"],
          ["Yashwant Rane", "9826450019", 3, "19:00", 10, "cancelled", "Guest rescheduled to next week"],
        ]
      : [
          ["Karan Vaidya", "9820770014", 1, "11:00", 2, "confirmed", "Working table with a plug point"],
          ["Priyanka Salvi", "9820770015", 2, "17:30", 4, "pending", ""],
          ["Ira Sathe", "9820770011", 0, "09:30", 2, "seated", ""],
        ];

  for (const [i, [name, phone, dayAhead, time, guests, status, note]] of reservations.entries()) {
    const d = new Date();
    d.setDate(d.getDate() + dayAhead);
    await ensure(
      "reservations",
      { restaurant_id: rid, booking_token: `${v.prefix}-RES-${1200 + i}` },
      { customer_name: name, customer_phone: phone, date: d.toISOString().slice(0, 10), time, guest_count: guests, status, special_request: note || null, reservation_type: "table", zone: guests > 6 ? "Private" : "Ground Floor", deposit_amount: money(guests > 6 ? 1000 : 0), deposit_status: guests > 6 ? "paid" : "none" },
    );
  }

  // --- waitlist ---------------------------------------------------------
  const queue = hotel
    ? [["Mohit Purbia", "9829770011", 4, "waiting", 20], ["Sarita Jain", "9829770022", 2, "notified", 5]]
    : v.slug === "kesar-kitchen"
      ? [["Anil Kushwah", "9826770011", 4, "waiting", 25], ["Deepak Soni", "9826770022", 2, "notified", 10], ["Shalini Verma", "9826770033", 6, "seated", 0]]
      : [["Aarti Sawant", "9820880011", 2, "waiting", 15], ["Rehan Kazi", "9820880022", 3, "waiting", 25]];

  for (const [i, [name, phone, party, status, wait]] of queue.entries()) {
    await ensure(
      "queue_entries",
      { restaurant_id: rid, public_token: `${v.prefix}-Q-${800 + i}` },
      { token_number: 40 + i, guest_name: name, guest_phone: phone, party_size: party, status, estimated_wait: wait, queue_type: "walk_in", notify_via: "sms", priority: "normal", notified_at: status === "notified" ? new Date() : null, seated_at: status === "seated" ? new Date() : null, created_at: new Date(Date.now() - (i + 1) * 11 * 60000) },
    );
  }

  // --- feedback ---------------------------------------------------------
  const settled = placed.filter((p) => SETTLED.has(p.order.status)).slice(0, 9);
  const comments = [
    [5, "Food came out fast and everything was hot. The staff kept checking on us without hovering."],
    [4, "Very good, though the table took about ten minutes longer than the app said it would."],
    [5, "Best meal we have had here in months. Portions were generous and the bill was fair."],
    [3, "Taste was fine but one dish arrived cold and had to go back."],
    [5, "Ordering from the QR was quick and the bill split without any fuss."],
    [4, "Comfortable and quiet on a weekday. Would come back for the same order."],
    [2, "Waited too long at the counter to settle up, and the receipt had to be printed twice."],
    [5, "Ordered from the room and it arrived in under twenty minutes, still warm."],
    [4, "Reliable as always. Would like a few more vegetarian options in the specials."],
  ];
  for (const [i, p] of settled.entries()) {
    const [rating, comment] = comments[i % comments.length];
    await ensure(
      "feedback",
      { restaurant_id: rid, order_id: p.order.id },
      { customer_name: p.order.customer_name, rating, food_rating: Math.min(5, rating + (i % 2)), service_rating: rating, ambience_rating: Math.max(1, rating - (i % 2)), comment, created_at: new Date(new Date(p.order.created_at).getTime() + 90 * 60000) },
    );
  }

  // --- coupons ----------------------------------------------------------
  const soon = new Date();
  soon.setMonth(soon.getMonth() + 4);
  const coupons = hotel
    ? [["STAY10", "percent", 10, 2000, 800, 200], ["LAKEVIEW250", "flat", 250, 1500, 250, 100]]
    : v.slug === "kesar-kitchen"
      ? [["KESAR15", "percent", 15, 1200, 400, 500], ["FIRSTPLATE100", "flat", 100, 600, 100, 300], ["WEEKDAY20", "percent", 20, 2000, 600, 150]]
      : [["BUNCLUB10", "percent", 10, 400, 150, 400], ["MORNINGBREW50", "flat", 50, 300, 50, 250]];

  for (const [code, type, value, minOrder, maxDiscount, limit] of coupons) {
    await ensure(
      "promo_codes",
      { restaurant_id: rid, code },
      { discount_type: type, discount_value: money(value), min_order_amount: money(minOrder), max_discount: money(maxDiscount), usage_limit: limit, used_count: Math.floor(limit * 0.2), is_active: true, expires_at: soon },
    );
  }

  // --- suppliers and purchase orders ------------------------------------
  const supplierNames = [...new Set(INVENTORY[v.slug].map((r) => r[6]))];
  const supplierIds = {};
  for (const [i, name] of supplierNames.entries()) {
    const s = await ensure(
      "suppliers",
      { restaurant_id: rid, name },
      { contact_person: ["Mahendra Solanki", "Ashok Verma", "Iqbal Shaikh", "Ganesh Pawar", "Dinesh Rathi", "Suresh Gupta"][i % 6], phone: `98${(26000000 + i * 111111).toString().slice(0, 8)}`, email: `orders@${name.toLowerCase().replace(/[^a-z]+/g, "")}.in`, address: v.address.split(",").slice(-2).join(",").trim(), category: "Provisions", rating: 3 + (i % 3), payment_terms: ["Net 15", "Net 30", "On delivery"][i % 3], credit_limit: money(50000), outstanding_balance: money((i % 3) * 8400), is_active: true },
    );
    supplierIds[name] = s.id;
  }

  const poStates = [["received", 5], ["received", 3], ["in_transit", 1], ["pending", 0]];
  for (const [i, [status, daysAgo]] of poStates.entries()) {
    const supplier = supplierNames[i % supplierNames.length];
    const picks = INVENTORY[v.slug].filter((r) => r[6] === supplier).slice(0, 3);
    if (!picks.length) continue;
    const lines = picks.map(([name, , unit, , min, cost]) => ({ name, quantity: Math.ceil(min * 2), unit, rate: cost, amount: Math.ceil(min * 2) * cost }));
    const sub = lines.reduce((s, l) => s + l.amount, 0);
    const expected = new Date();
    expected.setDate(expected.getDate() - daysAgo + 2);
    await ensure(
      "purchase_orders",
      { restaurant_id: rid, po_number: `${v.prefix}-PO-${2600 + i}` },
      { supplier_id: supplierIds[supplier], supplier_name: supplier, status, items: J(lines), subtotal: money(sub), tax: money(sub * 0.05), total: money(sub * 1.05), expected_delivery: expected, delivered_at: status === "received" ? at(daysAgo, 9) : null, notes: status === "pending" ? "Awaiting confirmation from the supplier" : null, created_at: at(daysAgo + 2, 10) },
    );
  }

  // --- tasks and SOPs ---------------------------------------------------
  const tasks = [
    ["Deep clean the exhaust hood", "maintenance", "high", "pending", "kitchen", 1],
    ["Verify closing cash against the day's bills", "finance", "high", "in_progress", "cashier", 0],
    ["Restock the condiment station before service", "operations", "normal", "completed", "waiter", 0],
    ["Renew the annual fire safety certificate", "compliance", "high", "pending", "manager", 21],
    ["Photograph the new specials for the menu", "marketing", "low", "pending", "manager", 7],
    ["Check the walk-in chiller temperature log", "compliance", "normal", "completed", "chef", 0],
  ];
  for (const [title, category, priority, status, role, dueIn] of tasks) {
    const due = new Date();
    due.setDate(due.getDate() + dueIn);
    await ensure(
      "tasks",
      { restaurant_id: rid, title },
      { category, priority, status, assigned_role: role, assigned_to: ctx.staffByRole[role]?.[0]?.name ?? null, due_date: due, completed_at: status === "completed" ? new Date() : null, description: null, is_recurring: category === "compliance", recurring_schedule: category === "compliance" ? "monthly" : null },
    );
  }

  const sops = [
    ["Opening checklist", "operations", "Unlock, switch on the mains, check the chiller log, count the float, brief the floor on the day's specials and anything the kitchen has run out of.", ["Unlock and disarm", "Switch on chillers and check the overnight log", "Count and record the cash float", "Walk the floor for cleanliness", "Take the shortage list from the chef"]],
    ["Closing checklist", "operations", "Settle every open table, cash up against the day's bills, cover and label all prep, run the dishwasher cycle, bin the wet waste and arm the alarm.", ["Settle all open tables", "Reconcile cash and card totals", "Label and refrigerate all prep", "Run the final dishwasher cycle", "Bin wet waste and arm the alarm"]],
    ["Handling a guest complaint", "service", "Listen without interrupting, apologise for the experience rather than arguing the facts, offer to remake or remove the item, tell the manager before the guest asks for one.", ["Listen fully", "Apologise for the experience", "Offer a remake or removal", "Inform the manager", "Note it on the order"]],
    ["Food safety and temperature control", "compliance", "Cooked food above 65C, cold storage below 5C, nothing reheated twice, every container dated on the day it was made.", ["Check hot holding above 65C", "Check chillers below 5C", "Date every prep container", "Discard anything past its date", "Record the readings"]],
  ];
  for (const [title, category, content, steps] of sops) {
    await ensure(
      "sop_items",
      { restaurant_id: rid, title },
      { category, content, steps: J(steps), assigned_roles: J(category === "service" ? ["waiter", "manager"] : ["manager", "chef", "kitchen"]), is_active: true },
    );
  }

  // --- housekeeping -----------------------------------------------------
  const hk = hotel
    ? [
        ["Turn down service - Room 201", "turndown", "Room 201", "201", "pending", "normal"],
        ["Full clean after checkout - Room 103", "cleaning", "Room 103", "103", "in_progress", "high"],
        ["Replace shower head - Room 204", "maintenance", "Room 204", "204", "pending", "high"],
        ["Restock minibar - Room 301", "restocking", "Room 301", "301", "completed", "normal"],
        ["Lobby floor polish", "cleaning", "Lobby", null, "pending", "low"],
      ]
    : [
        ["Sanitise the dining floor before service", "cleaning", "Ground Floor", null, "completed", "normal"],
        ["Terrace furniture wipe down", "cleaning", "Terrace", null, "pending", "normal"],
        ["Washroom deep clean", "cleaning", "Washrooms", null, "in_progress", "high"],
        ["Replace the entrance floor mat", "maintenance", "Entrance", null, "pending", "low"],
      ];
  for (const [title, type, location, room, status, priority] of hk) {
    await ensure(
      "housekeeping_tasks",
      { restaurant_id: rid, title },
      { type, location, room_number: room, status, priority, assigned_to: ctx.staffByRole.housekeeping?.[0]?.name ?? null, scheduled_at: at(0, 7), completed_at: status === "completed" ? at(0, 9) : null, is_recurring: type === "cleaning", recurring_interval: type === "cleaning" ? "daily" : null },
    );
  }

  // --- spa and banquets -------------------------------------------------
  if (hotel) {
    const services = [
      ["Abhyanga Full Body Massage", "Massage", 60, 2800, "Yogesh Paliwal", "Warm sesame oil massage in the Kerala style, two therapists on request"],
      ["Aroma Back and Shoulder", "Massage", 30, 1600, "Yogesh Paliwal", "Targeted relief for desk and driving stiffness"],
      ["Rajasthani Herbal Facial", "Facial", 45, 2200, "Ritika Purohit", "Multani mitti, rose and sandalwood, finished with a neck massage"],
      ["Foot Reflexology", "Therapy", 40, 1400, "Yogesh Paliwal", "Pressure point work for guests who have been walking the city all day"],
      ["Steam and Sauna Access", "Facility", 45, 800, null, "Per guest, towels and slippers included"],
    ];
    const serviceIds = {};
    for (const [name, category, duration, price, therapist, description] of services) {
      const s = await ensure("spa_services", { restaurant_id: rid, name }, { category, duration, price: money(price), therapist, description, is_bar: false, is_available: true });
      serviceIds[name] = s.id;
    }
    const bookings = [
      ["Sanjay Kothari", "9822330244", "Abhyanga Full Body Massage", 0, 17, "confirmed", "paid"],
      ["Kavita Bhatnagar", "9930220133", "Rajasthani Herbal Facial", 0, 11, "completed", "paid"],
      ["Harpreet Gill", "9878550466", "Foot Reflexology", 1, 19, "confirmed", "pending"],
      ["Elena Fischer", "9711440355", "Aroma Back and Shoulder", 1, 16, "pending", "pending"],
    ];
    for (const [guest, phone, service, dayAhead, hour, status, payment] of bookings) {
      const when = new Date();
      when.setDate(when.getDate() + dayAhead);
      when.setHours(hour, 0, 0, 0);
      const svc = services.find((s) => s[0] === service);
      await ensure(
        "spa_bookings",
        { restaurant_id: rid, guest_name: guest, service_name: service },
        { service_id: serviceIds[service], guest_phone: phone, therapist: svc[4], scheduled_at: when, duration: svc[2], price: money(svc[3]), status, payment_status: payment, booking_type: "in_house" },
      );
    }

    const events = [
      ["Rathore Sangeet", "sangeet", 12, "19:00", 180, "Terrace Lawn", "confirmed", 150000, 420000, "Devendra Singh Rathore", "9414022301"],
      ["Chartered Accountants Conclave", "conference", 21, "10:00", 90, "Banquet Hall", "confirmed", 60000, 235000, "Nirmal Bafna", "9414077880"],
      ["Bhandari Wedding Reception", "wedding", 34, "20:00", 320, "Banquet Hall", "enquiry", 0, 780000, "Suresh Bhandari", "9414066770"],
    ];
    for (const [name, type, dayAhead, time, guests, venue, status, advance, total, contact, phone] of events) {
      const d = new Date();
      d.setDate(d.getDate() + dayAhead);
      await ensure(
        "banquet_events",
        { restaurant_id: rid, name },
        { type, event_date: d, event_time: time, guest_count: guests, venue, status, advance_paid: money(advance), total_amount: money(total), contact_name: contact, contact_phone: phone, menu: "Rajasthani thali counter, live chaat, two tandoor stations", catering: true, decor: true, staff_assigned: J(["Anita Chouhan", "Mahesh Solanki"]), notes: null },
      );
    }
  } else if (v.slug === "kesar-kitchen") {
    await ensure(
      "banquet_events",
      { restaurant_id: rid, name: "Trivedi Engagement Lunch" },
      { type: "engagement", event_date: at(-9, 13), event_time: "13:00", guest_count: 45, venue: "Private Room", status: "confirmed", advance_paid: money(15000), total_amount: money(67500), contact_name: "Anand Trivedi", contact_phone: "9826450014", menu: "Vegetarian buffet, live chaat counter, two sweets", catering: true, decor: false, staff_assigned: J(["Sunita Bhargava"]), notes: null },
    );
  }

  // --- waiter calls -----------------------------------------------------
  const calls = v.slug === "kesar-kitchen"
    ? [["G-2", "request_water", "Two bottles of water please", false], ["AC-4", "payment_request", "Guest would like to settle by card", false], ["TR-2", "call_waiter", null, true]]
    : hotel
      ? [["AC-2", "request_cutlery", "One more serving spoon", false], ["TR-1", "call_waiter", null, true]]
      : [["G-3", "request_assistance", "Asking about the oat milk options", false], ["TR-1", "call_waiter", null, true]];
  for (const [tableName, type, message, resolved] of calls) {
    const t = ctx.tableByName[tableName];
    await ensure(
      "waiter_calls",
      { restaurant_id: rid, table_name: tableName, type },
      { table_id: t?.id ?? null, message, is_resolved: resolved, created_at: new Date(Date.now() - (resolved ? 40 : 6) * 60000) },
    );
  }

  // --- expenses and the cash drawer -------------------------------------
  const expenses = [
    ["Rent", "Monthly rent", hotel ? 185000 : v.slug === "kesar-kitchen" ? 95000 : 62000, 4],
    ["Salaries", "Staff salaries", STAFF[v.slug].reduce((s, r) => s + r[5], 0), 4],
    ["Utilities", "Electricity and water", hotel ? 74000 : 31000, 3],
    ["Provisions", "Weekly grocery run", hotel ? 48000 : 27000, 2],
    ["Gas", "Commercial LPG refill", 9600, 1],
  ];
  for (const [i, [category, description, amount, daysAgo]] of expenses.entries()) {
    await ensure(
      "finance_transactions",
      { restaurant_id: rid, reference: `${v.prefix}-EXP-${300 + i}` },
      { type: "expense", category, description, amount: money(amount), payment_method: "bank_transfer", performed_by: ctx.staffByRole.finance?.[0]?.name ?? "Accounts", date: at(daysAgo, 11) },
    );
  }
}

// ===========================================================================
// Verification — nothing here is trusted until it answers over HTTP
// ===========================================================================

async function call(method, pathname, body, cookie) {
  // A dev API restarts on file change, which drops in-flight sockets. A seed run that takes
  // a minute will meet that sooner or later, so a connection error is retried rather than
  // reported as a broken endpoint.
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const res = await fetch(`${API}${pathname}`, {
        method,
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { status: res.status, body: parsed, cookie: res.headers.get("set-cookie")?.split(";")[0] };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function verify(contexts) {
  console.log("\n--- verifying over HTTP ---\n");
  let apiUp = true;
  try {
    const health = await call("GET", "/health");
    apiUp = health.status === 200;
  } catch {
    apiUp = false;
  }
  if (!apiUp) {
    console.log(`  API at ${API} is not answering — skipping the HTTP checks. Rows are seeded.`);
    summary.notes.push("HTTP verification skipped: API not reachable");
    return;
  }

  for (const ctx of contexts) {
    const menu = await call("GET", `/public/menu/${ctx.v.slug}`);
    const cats = Array.isArray(menu.body?.categories) ? menu.body.categories : [];
    const items = cats.reduce((s, c) => s + (c.items?.length ?? 0), 0);
    console.log(`  menu ${ctx.v.slug.padEnd(20)} ${menu.status} — ${cats.length} categories, ${items} items, ${menu.body?.featuredItems?.length ?? 0} featured`);
    if (menu.status !== 200 || items === 0) summary.notes.push(`guest menu for ${ctx.v.slug} returned ${menu.status} with ${items} items`);
  }

  let ok = 0;
  const failed = [];
  for (const login of summary.logins) {
    const res = await call("POST", "/restaurant-auth/login", { email: login.email, password: STAFF_PASSWORD });
    if (res.status === 200) ok += 1;
    else failed.push(`${login.email} -> ${res.status} ${JSON.stringify(res.body).slice(0, 80)}`);
  }
  console.log(`  staff logins        ${ok}/${summary.logins.length} signed in`);
  for (const f of failed) console.log(`    FAILED ${f}`);
  if (failed.length) summary.notes.push(`${failed.length} staff logins failed`);

  // Does a sale actually move stock? Place a real order for a recipe-backed dish, read
  // the ingredient before and after, then undo everything the check created.
  const ctx = contexts[0];
  const dish = "Murgh Makhani";
  const ingredient = "Chicken Curd Cut";
  const item = ctx.itemByName[dish];
  const [before] = await q(`select current_stock from inventory_items where restaurant_id = $1 and name = $2`, [ctx.rid, ingredient]);
  const placed = await call("POST", "/public/orders", {
    restaurantId: ctx.rid,
    tableName: "G-1",
    customerName: "Stock check",
    type: "dine_in",
    items: [{ menuItemId: item.id, quantity: 2, variant: "Full", addons: [{ name: "Extra Gravy" }] }],
  });
  if (placed.status !== 201) {
    console.log(`  stock drawdown      order rejected ${placed.status} ${JSON.stringify(placed.body).slice(0, 90)}`);
    summary.notes.push(`stock drawdown unverified: order POST returned ${placed.status}`);
  } else {
    const [after] = await q(`select current_stock from inventory_items where restaurant_id = $1 and name = $2`, [ctx.rid, ingredient]);
    const used = Number(before.current_stock) - Number(after.current_stock);
    const orderId = placed.body.id;
    const expectedTotal = 2 * (495 + 70) * 1.05;
    console.log(`  stock drawdown      ${ingredient} ${before.current_stock} -> ${after.current_stock} (${used.toFixed(3)} kg drawn for 2x ${dish})`);
    console.log(`  variant pricing     2x Full + Extra Gravy billed ${placed.body.total} (expected ${expectedTotal.toFixed(2)})`);
    if (used <= 0) summary.notes.push("stock did not move when an order was placed");
    if (Math.abs(Number(placed.body.total) - expectedTotal) > 0.02) summary.notes.push(`variant/addon pricing off: got ${placed.body.total}`);

    // Undo: put the stock back, drop the ledger entries and the order, so a second run of
    // this script starts from exactly the same place.
    for (const t of await q(`select item_id, quantity from inventory_transactions where reference = $1`, [`ORD-${orderId}`])) {
      await q(`update inventory_items set current_stock = current_stock + $1 where id = $2`, [t.quantity, t.item_id]);
    }
    await q(`delete from inventory_transactions where reference = $1`, [`ORD-${orderId}`]);
    await q(`update tables_map set current_order_id = null where current_order_id = $1`, [orderId]);
    await q(`delete from orders where id = $1`, [orderId]);
    await q(`update tables_map set status = 'free', current_customer_name = null, current_guest_count = 0, occupied_since = null where restaurant_id = $1 and name = 'G-1'`, [ctx.rid]);
  }
}

async function report(contexts) {
  const ids = contexts.map((c) => c.rid);
  const [venues] = await q(`select count(*)::int as n from restaurants where id = any($1::int[])`, [ids]);
  const tables = [
    "branches", "staff", "table_areas", "tables_map", "qr_codes", "categories",
    "menu_items", "inventory_items", "recipes", "hotel_rooms", "customers", "orders",
    "finance_transactions", "reservations", "queue_entries", "feedback", "promo_codes",
    "suppliers", "purchase_orders", "tasks", "sop_items", "housekeeping_tasks",
    "spa_services", "spa_bookings", "banquet_events", "room_service_requests", "waiter_calls",
    "loyalty_programs",
  ];

  console.log("\n--- rows for the three seeded venues ---\n");
  console.log(`  ${"restaurants".padEnd(24)} ${String(venues.n).padStart(5)}`);
  for (const t of tables) {
    const [row] = await q(`select count(*)::int as n from "${t}" where restaurant_id = any($1::int[])`, [ids]);
    if (row.n) console.log(`  ${t.padEnd(24)} ${String(row.n).padStart(5)}`);
  }
  const [ri] = await q(`select count(*)::int as n from recipe_ingredients where restaurant_id = any($1::int[])`, [ids]);
  console.log(`  ${"recipe_ingredients".padEnd(24)} ${String(ri.n).padStart(5)}`);

  console.log("\n  orders by status:");
  for (const r of await q(`select status, count(*)::int as n from orders where restaurant_id = any($1::int[]) group by 1 order by 2 desc`, [ids])) {
    console.log(`    ${r.status.padEnd(12)} ${r.n}`);
  }
  console.log("  orders by type:");
  for (const r of await q(`select type, count(*)::int as n from orders where restaurant_id = any($1::int[]) group by 1 order by 2 desc`, [ids])) {
    console.log(`    ${r.type.padEnd(12)} ${r.n}`);
  }

  console.log("\n--- staff logins (password for every account below) ---\n");
  console.log(`  password: ${STAFF_PASSWORD}\n`);
  let venue = "";
  for (const l of summary.logins) {
    if (l.venue !== venue) {
      venue = l.venue;
      console.log(`  ${venue}`);
    }
    console.log(`    ${l.role.padEnd(13)} ${l.email.padEnd(44)} ${l.name}`);
  }

  console.log("\n--- guest entry points ---\n");
  for (const c of contexts) {
    const first = Object.keys(c.tableByName)[0];
    console.log(`  ${c.v.name}`);
    console.log(`    menu   http://localhost:5000/user/menu?slug=${c.v.slug}&table=${first}`);
    console.log(`    scan   http://localhost:5000/scan/${c.v.slug}?table=${first}&entry=qr`);
  }

  if (summary.notes.length) {
    console.log("\n--- needs attention ---\n");
    for (const n of summary.notes) console.log(`  ${n}`);
  }
}

async function main() {
  await db.connect();
  console.log("=== seeding demo world ===\n");
  const contexts = [];
  for (const v of VENUES) {
    const ctx = await seedVenue(v);
    const placed = await seedOrders(ctx);
    await seedOperations(ctx, placed);
    console.log(`  ${v.name.padEnd(28)} restaurant #${ctx.rid} — ${MENU[v.slug].length} dishes, ${(TABLES[v.slug] ?? []).length} tables, ${STAFF[v.slug].length} staff, ${placed.length} orders`);
    contexts.push(ctx);
  }

  // Rows are already committed by this point. A flaky API must not turn a good seed into a
  // failed exit code, so the checks report what they found and get out of the way.
  try {
    await verify(contexts);
  } catch (err) {
    console.log(`\n  HTTP verification stopped early: ${String(err).slice(0, 120)}`);
    summary.notes.push("HTTP verification did not finish — re-run once the API is up");
  }
  await report(contexts);
  await db.end();
  console.log("");
}

main().catch(async (err) => {
  console.error("\nseed failed:", err);
  await db.end().catch(() => {});
  process.exit(1);
});
