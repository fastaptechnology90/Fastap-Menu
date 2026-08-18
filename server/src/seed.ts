import "./types.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable, restaurantsTable, categoriesTable, menuItemsTable,
  branchesTable, tablesMapTable, staffTable, customersTable,
  loyaltyProgramsTable, campaignsTable, reservationsTable,
  feedbackTable, ordersTable,
} from "./db/index.js";

async function seed() {
  console.log("Seeding database...");

  // 1. Super admin
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, "superadmin@fastapmenu.com"));
  let superAdmin = existing[0];
  if (!superAdmin) {
    const hash = await bcrypt.hash("Admin@123", 12);
    [superAdmin] = await db.insert(usersTable).values({ name: "Super Admin", email: "superadmin@fastapmenu.com", passwordHash: hash, role: "super_admin" }).returning();
    console.log("Created super admin");
  } else { console.log("Super admin already exists"); }

  // 2. Demo restaurant owner
  const demoEmail = "demo@fastapmenu.com";
  const existingOwner = await db.select().from(usersTable).where(eq(usersTable.email, demoEmail));
  let owner = existingOwner[0];
  if (!owner) {
    const hash = await bcrypt.hash("Demo@123", 12);
    [owner] = await db.insert(usersTable).values({ name: "Demo Owner", email: demoEmail, passwordHash: hash, role: "restaurant_owner" }).returning();
    console.log("Created demo owner");
  }

  // 3. Demo restaurant
  const existingRest = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, "spice-garden"));
  let restaurant = existingRest[0];
  if (!restaurant) {
    [restaurant] = await db.insert(restaurantsTable).values({
      userId: owner.id, name: "Spice Garden", slug: "spice-garden",
      description: "Authentic flavors from the heart of South Asia. Fresh ingredients, bold spices, warm hospitality.",
      address: "123 Main Street, Dubai, UAE", phone: "+971 50 123 4567",
      email: "hello@spicegarden.com", website: "https://spicegarden.com",
      currency: "AED", primaryColor: "#f97316", businessType: "restaurant",
      timezone: "Asia/Dubai", isActive: true, plan: "pro",
    }).returning();
    console.log("Created demo restaurant");
  }

  // 4. Branch
  const existingBranch = await db.select().from(branchesTable).where(eq(branchesTable.restaurantId, restaurant.id));
  let branch = existingBranch[0];
  if (!branch) {
    [branch] = await db.insert(branchesTable).values({ restaurantId: restaurant.id, name: "Main Branch", address: "123 Main Street, Dubai", phone: "+971 50 123 4567", isActive: true }).returning();
  }

  // 5. Tables
  const existingTables = await db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, restaurant.id));
  if (existingTables.length === 0) {
    for (let i = 1; i <= 12; i++) {
      await db.insert(tablesMapTable).values({ restaurantId: restaurant.id, branchId: branch.id, name: `T${i}`, zone: i <= 6 ? "Indoor" : "Outdoor", capacity: i % 3 === 0 ? 6 : 4, isActive: true });
    }
    console.log("Created 12 tables");
  }

  // 6. Categories
  const existingCats = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurant.id));
  let categories = existingCats;
  if (categories.length === 0) {
    const catData = [
      { name: "Starters", sortOrder: 1 }, { name: "Main Course", sortOrder: 2 },
      { name: "Biryanis", sortOrder: 3 }, { name: "Breads", sortOrder: 4 },
      { name: "Desserts", sortOrder: 5 }, { name: "Beverages", sortOrder: 6 },
    ];
    categories = await db.insert(categoriesTable).values(catData.map(c => ({ ...c, restaurantId: restaurant.id, isAvailable: true }))).returning();
    console.log("Created categories");
  }

  // 7. Menu items
  const existingItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id));
  if (existingItems.length === 0) {
    const catMap = Object.fromEntries(categories.map(c => [c.name, c.id]));
    const items = [
      { categoryId: catMap["Starters"], name: "Samosa Platter", description: "Crispy fried pastry filled with spiced potatoes and peas", price: "22", spiceLevel: 1, dietaryTags: ["vegetarian"], isFeatured: true, orderCount: 145 },
      { categoryId: catMap["Starters"], name: "Chicken Tikka", description: "Tender chicken marinated in yogurt and spices, grilled in tandoor", price: "45", spiceLevel: 2, dietaryTags: [], isFeatured: true, orderCount: 220 },
      { categoryId: catMap["Starters"], name: "Paneer Tikka", description: "Indian cottage cheese marinated in spices, grilled to perfection", price: "38", spiceLevel: 1, dietaryTags: ["vegetarian", "gluten-free"], isFeatured: false, orderCount: 98 },
      { categoryId: catMap["Starters"], name: "Soup of the Day", description: "Chef's special seasonal soup served with bread roll", price: "18", spiceLevel: 0, dietaryTags: [], isFeatured: false, orderCount: 67 },
      { categoryId: catMap["Main Course"], name: "Butter Chicken", description: "Creamy tomato-based curry with tender chicken pieces", price: "65", spiceLevel: 1, dietaryTags: ["gluten-free"], isFeatured: true, orderCount: 312 },
      { categoryId: catMap["Main Course"], name: "Dal Makhani", description: "Slow-cooked black lentils with cream and butter", price: "42", spiceLevel: 1, dietaryTags: ["vegetarian", "gluten-free"], isFeatured: false, orderCount: 189 },
      { categoryId: catMap["Main Course"], name: "Lamb Rogan Josh", description: "Slow-cooked tender lamb in aromatic Kashmiri gravy", price: "75", spiceLevel: 3, dietaryTags: ["gluten-free"], isFeatured: true, orderCount: 156 },
      { categoryId: catMap["Main Course"], name: "Palak Paneer", description: "Fresh cottage cheese cubes in smooth spinach gravy", price: "48", spiceLevel: 1, dietaryTags: ["vegetarian", "gluten-free"], isFeatured: false, orderCount: 134 },
      { categoryId: catMap["Biryanis"], name: "Chicken Biryani", description: "Fragrant basmati rice layered with spiced chicken, served with raita", price: "58", spiceLevel: 2, dietaryTags: [], isFeatured: true, orderCount: 445 },
      { categoryId: catMap["Biryanis"], name: "Mutton Biryani", description: "Premium mutton pieces slow-cooked with aromatic rice", price: "72", spiceLevel: 2, dietaryTags: [], isFeatured: false, orderCount: 289 },
      { categoryId: catMap["Biryanis"], name: "Veg Biryani", description: "Mixed vegetables and paneer with fragrant basmati", price: "48", spiceLevel: 1, dietaryTags: ["vegetarian"], isFeatured: false, orderCount: 167 },
      { categoryId: catMap["Breads"], name: "Butter Naan", description: "Soft leavened bread baked in tandoor, brushed with butter", price: "12", spiceLevel: 0, dietaryTags: ["vegetarian"], isFeatured: false, orderCount: 534 },
      { categoryId: catMap["Breads"], name: "Garlic Naan", description: "Naan topped with fresh garlic and butter", price: "14", spiceLevel: 0, dietaryTags: ["vegetarian"], isFeatured: false, orderCount: 398 },
      { categoryId: catMap["Breads"], name: "Cheese Naan", description: "Stuffed with melted cheese, baked in tandoor", price: "18", spiceLevel: 0, dietaryTags: ["vegetarian"], isFeatured: false, orderCount: 267 },
      { categoryId: catMap["Desserts"], name: "Gulab Jamun", description: "Soft milk-solid dumplings soaked in rose-flavored sugar syrup", price: "22", spiceLevel: 0, dietaryTags: ["vegetarian"], isFeatured: true, orderCount: 234 },
      { categoryId: catMap["Desserts"], name: "Mango Kulfi", description: "Traditional Indian ice cream with fresh mango", price: "25", spiceLevel: 0, dietaryTags: ["vegetarian", "gluten-free"], isFeatured: false, orderCount: 178 },
      { categoryId: catMap["Beverages"], name: "Mango Lassi", description: "Creamy yogurt drink blended with fresh mangoes", price: "20", spiceLevel: 0, dietaryTags: ["vegetarian", "gluten-free"], isFeatured: true, orderCount: 312 },
      { categoryId: catMap["Beverages"], name: "Masala Chai", description: "Spiced Indian tea brewed with ginger and cardamom", price: "12", spiceLevel: 0, dietaryTags: ["vegetarian"], isFeatured: false, orderCount: 289 },
      { categoryId: catMap["Beverages"], name: "Fresh Lime Soda", description: "Freshly squeezed lime with soda water", price: "14", spiceLevel: 0, dietaryTags: ["vegan", "gluten-free"], isFeatured: false, orderCount: 198 },
    ];
    await db.insert(menuItemsTable).values(items.map(i => ({ ...i, restaurantId: restaurant.id, isAvailable: true, sortOrder: 0, variants: [], addons: [] })));
    console.log("Created menu items");
  }

  // 8. Staff
  const existingStaff = await db.select().from(staffTable).where(eq(staffTable.restaurantId, restaurant.id));
  if (existingStaff.length === 0) {
    await db.insert(staffTable).values([
      { restaurantId: restaurant.id, name: "Ahmed Al-Rashidi", email: "ahmed@spicegarden.com", role: "manager", isActive: true },
      { restaurantId: restaurant.id, name: "Priya Sharma", email: "priya@spicegarden.com", role: "waiter", isActive: true },
      { restaurantId: restaurant.id, name: "Mohammed Hassan", email: "mohammed@spicegarden.com", role: "kitchen", isActive: true },
      { restaurantId: restaurant.id, name: "Sara Johnson", email: "sara@spicegarden.com", role: "cashier", isActive: true },
    ]);
    console.log("Created staff");
  }

  // 9. Customers
  const existingCustomers = await db.select().from(customersTable).where(eq(customersTable.restaurantId, restaurant.id));
  if (existingCustomers.length === 0) {
    await db.insert(customersTable).values([
      { restaurantId: restaurant.id, name: "Ali Al-Mansoori", phone: "+971501234001", email: "ali@example.com", totalOrders: 24, totalSpend: "1845", loyaltyPoints: 184, lastVisit: new Date("2026-05-10"), segment: "vip" },
      { restaurantId: restaurant.id, name: "Fatima Zahra", phone: "+971501234002", email: "fatima@example.com", totalOrders: 12, totalSpend: "934", loyaltyPoints: 93, lastVisit: new Date("2026-05-09"), segment: "regular" },
      { restaurantId: restaurant.id, name: "James Smith", phone: "+971501234003", email: "james@example.com", totalOrders: 8, totalSpend: "672", loyaltyPoints: 67, lastVisit: new Date("2026-05-08"), segment: "regular" },
      { restaurantId: restaurant.id, name: "Aisha Khan", phone: "+971501234004", email: "aisha@example.com", totalOrders: 2, totalSpend: "156", loyaltyPoints: 15, lastVisit: new Date("2026-05-11"), segment: "new" },
      { restaurantId: restaurant.id, name: "David Chen", phone: "+971501234005", email: "david@example.com", totalOrders: 1, totalSpend: "89", loyaltyPoints: 8, lastVisit: new Date("2026-05-12"), segment: "new" },
      { restaurantId: restaurant.id, name: "Noor Al-Ahmad", phone: "+971501234006", email: "noor@example.com", totalOrders: 35, totalSpend: "2890", loyaltyPoints: 289, lastVisit: new Date("2026-04-20"), segment: "vip" },
    ]);
    console.log("Created customers");
  }

  // 10. Loyalty
  const existingLoyalty = await db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.restaurantId, restaurant.id));
  if (existingLoyalty.length === 0) {
    await db.insert(loyaltyProgramsTable).values({ restaurantId: restaurant.id, isEnabled: true, type: "points", pointsPerDollar: "10", cashbackPercent: "5", stampsForReward: 10, rewardValue: "25", expiryDays: 365 });
    console.log("Created loyalty program");
  }

  // 11. Campaigns
  const existingCampaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.restaurantId, restaurant.id));
  if (existingCampaigns.length === 0) {
    await db.insert(campaignsTable).values([
      { restaurantId: restaurant.id, name: "Happy Hour Special", type: "happy_hour", description: "20% off all beverages from 3PM to 6PM", discountPercent: "20", triggerType: "scheduled", startDate: "2026-05-01", endDate: "2026-06-30", isActive: true },
      { restaurantId: restaurant.id, name: "Welcome Discount", type: "discount", description: "10% off for first-time customers", discountPercent: "10", triggerType: "first_order", isActive: true, targetSegment: "new" },
      { restaurantId: restaurant.id, name: "VIP Cashback", type: "discount", description: "15% cashback for VIP customers", discountPercent: "15", triggerType: "manual", isActive: false, targetSegment: "vip" },
    ]);
    console.log("Created campaigns");
  }

  // 12. Reservations
  const existingRes = await db.select().from(reservationsTable).where(eq(reservationsTable.restaurantId, restaurant.id));
  if (existingRes.length === 0) {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    await db.insert(reservationsTable).values([
      { restaurantId: restaurant.id, customerName: "Ali Al-Mansoori", customerPhone: "+971501234001", customerEmail: "ali@example.com", date: today, time: "19:00", guestCount: 4, status: "confirmed", notes: "Window table preferred" },
      { restaurantId: restaurant.id, customerName: "Fatima Zahra", customerPhone: "+971501234002", customerEmail: "fatima@example.com", date: today, time: "20:30", guestCount: 2, status: "pending" },
      { restaurantId: restaurant.id, customerName: "Corporate Booking", customerPhone: "+971507654321", customerEmail: "corp@example.com", date: tomorrow, time: "13:00", guestCount: 12, status: "pending", notes: "Private room required" },
      { restaurantId: restaurant.id, customerName: "James Smith", customerPhone: "+971501234003", customerEmail: "james@example.com", date: tomorrow, time: "18:30", guestCount: 3, status: "confirmed" },
    ]);
    console.log("Created reservations");
  }

  // 13. Feedback
  const existingFeedback = await db.select().from(feedbackTable).where(eq(feedbackTable.restaurantId, restaurant.id));
  if (existingFeedback.length === 0) {
    await db.insert(feedbackTable).values([
      { restaurantId: restaurant.id, customerName: "Ali Al-Mansoori", rating: 5, foodRating: 5, serviceRating: 4, ambienceRating: 5, comment: "Absolutely love the Chicken Biryani here. Best in Dubai!" },
      { restaurantId: restaurant.id, customerName: "Fatima Zahra", rating: 4, foodRating: 4, serviceRating: 5, ambienceRating: 4, comment: "Great service, food was delicious. Will definitely come back." },
      { restaurantId: restaurant.id, customerName: "James Smith", rating: 5, foodRating: 5, serviceRating: 5, ambienceRating: 4, comment: "The Butter Chicken is outstanding. Highly recommend!" },
      { restaurantId: restaurant.id, customerName: "Aisha Khan", rating: 3, foodRating: 3, serviceRating: 4, ambienceRating: 3, comment: "Food was good but took a while to arrive." },
    ]);
    console.log("Created feedback");
  }

  // 14. Sample orders
  const existingOrders = await db.select().from(ordersTable).where(eq(ordersTable.restaurantId, restaurant.id));
  if (existingOrders.length === 0) {
    const menuItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id));
    const mi = menuItems.slice(0, 6);
    if (mi.length >= 3) {
      await db.insert(ordersTable).values([
        {
          restaurantId: restaurant.id, tableName: "T3", customerName: "Walk-in", type: "dine_in", status: "preparing",
          items: [{ menuItemId: mi[0].id, name: mi[0].name, price: parseFloat(mi[0].price), quantity: 2, subtotal: parseFloat(mi[0].price) * 2 }, { menuItemId: mi[2].id, name: mi[2].name, price: parseFloat(mi[2].price), quantity: 1, subtotal: parseFloat(mi[2].price) }],
          subtotal: String((parseFloat(mi[0].price) * 2 + parseFloat(mi[2].price)).toFixed(2)),
          tax: String(((parseFloat(mi[0].price) * 2 + parseFloat(mi[2].price)) * 0.05).toFixed(2)),
          total: String(((parseFloat(mi[0].price) * 2 + parseFloat(mi[2].price)) * 1.05).toFixed(2)), paymentStatus: "pending",
        },
        {
          restaurantId: restaurant.id, tableName: "T7", customerName: "Ali Al-Mansoori", customerPhone: "+971501234001", type: "dine_in", status: "delivered",
          items: [{ menuItemId: mi[4].id, name: mi[4].name, price: parseFloat(mi[4].price), quantity: 1, subtotal: parseFloat(mi[4].price) }],
          subtotal: String(parseFloat(mi[4].price).toFixed(2)), tax: String((parseFloat(mi[4].price) * 0.05).toFixed(2)),
          total: String((parseFloat(mi[4].price) * 1.05).toFixed(2)), paymentStatus: "paid",
        },
      ]);
      console.log("Created sample orders");
    }
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((e) => { console.error("Seed error:", e); process.exit(1); });
