import "./load-env.js";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db, usersTable, restaurantsTable, categoriesTable, menuItemsTable, branchesTable, tablesMapTable, tableAreasTable, staffTable, customersTable, loyaltyProgramsTable, loyaltyTransactionsTable, campaignsTable, reservationsTable, feedbackTable, ordersTable, hotelRoomsTable, DEFAULT_ROOM_CONTROLS, queueEntriesTable, banquetEventsTable, spaServicesTable, spaBookingsTable, guestUsersTable, walletTransactionsTable, promoCodesTable, auditLogsTable, documentsTable, suppliersTable, purchaseOrdersTable, tasksTable, sopItemsTable, cashShiftsTable, financeTransactionsTable, inventoryItemsTable, housekeepingTasksTable, maintenanceRequestsTable, roomServiceRequestsTable, waiterCallsTable, recipesTable, chatMessagesTable, staffCommissionsTable } from "@workspace/db";
import { setSettingsSection } from "./lib/restaurant-settings.js";
import { ensureDemoStaffAccounts, DEMO_STAFF_PASSWORD } from "./lib/demo-staff.js";
import { allCategorySeeds, MENU_ITEMS_SEED, DEFAULT_CUSTOMIZATION } from "./seed-menu-data.js";

async function ensureDigitalMenu(restaurantId: number) {
  const catSeeds = allCategorySeeds();
  let categories = await db.select().from(categoriesTable).where(eq(categoriesTable.restaurantId, restaurantId));

  for (const cat of catSeeds) {
    if (!categories.some(c => c.slug === cat.slug)) {
      const [inserted] = await db.insert(categoriesTable).values({
        restaurantId,
        name: cat.name,
        slug: cat.slug,
        categoryGroup: cat.categoryGroup,
        sortOrder: cat.sortOrder,
        isAvailable: true,
      }).returning();
      categories.push(inserted);
    }
  }
  console.log(`Ensured ${categories.length} menu categories`);

  const catBySlug = Object.fromEntries(categories.filter(c => c.slug).map(c => [c.slug!, c.id]));
  const existingItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurantId));
  const existingNames = new Set(existingItems.map(i => i.name));

  const itemsToInsert = MENU_ITEMS_SEED
    .filter(item => !existingNames.has(item.name))
    .map(item => ({
      restaurantId,
      categoryId: catBySlug[item.categorySlug],
      name: item.name,
      description: item.description,
      price: item.price,
      spiceLevel: item.spiceLevel ?? 0,
      dietaryTags: item.dietaryTags,
      isFeatured: item.isFeatured ?? false,
      isAvailable: true,
      sortOrder: 0,
      orderCount: item.orderCount ?? 0,
      viewCount: item.viewCount ?? 0,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      prepTime: item.prepTime,
      prepMethod: item.prepMethod,
      ingredients: item.ingredients,
      allergens: item.allergens,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
      preview360Url: item.preview360Url,
      chefRecommended: item.chefRecommended ?? false,
      variants: item.variants ?? [],
      addons: item.addons ?? [],
      customizationOptions: { ...DEFAULT_CUSTOMIZATION, ...(item.customizationOptions ?? {}) },
    }))
    .filter(i => i.categoryId);

  if (itemsToInsert.length > 0) {
    await db.insert(menuItemsTable).values(itemsToInsert);
    console.log(`Created ${itemsToInsert.length} digital menu items`);
  } else if (existingItems.length === 0) {
    console.log("No menu items seeded — category slugs may be missing");
  } else {
    console.log("Digital menu items already present");
  }
}

type TableSpec = {
  name: string;
  zone: string;
  capacity: number;
  status: string;
  tableType: string;
  tableCategory: string;
  guestCount?: number;
  customerName?: string;
  waiterName?: string;
  occupiedMinutesAgo?: number;
  isVip?: boolean;
};

const DEMO_TABLES: TableSpec[] = [
  // Restaurant tables — all types
  { name: "T-2A", zone: "AC Section", capacity: 2, status: "free", tableType: "2_seater", tableCategory: "restaurant" },
  { name: "T-4A", zone: "AC Section", capacity: 4, status: "occupied", tableType: "4_seater", tableCategory: "restaurant", guestCount: 3, customerName: "Rahul Kumar", waiterName: "Priya Sharma", occupiedMinutesAgo: 25 },
  { name: "T-6A", zone: "Premium Indoor", capacity: 6, status: "free", tableType: "6_seater", tableCategory: "restaurant" },
  { name: "T-FAM", zone: "Family Section", capacity: 8, status: "occupied", tableType: "family", tableCategory: "restaurant", guestCount: 6, customerName: "James Smith", waiterName: "Ahmed Al-Rashidi", occupiedMinutesAgo: 15 },
  { name: "T-VIP", zone: "VIP Lounge", capacity: 4, status: "vip_occupied", tableType: "vip", tableCategory: "restaurant", guestCount: 4, customerName: "Noor Al-Ahmad", waiterName: "Ahmed Al-Rashidi", occupiedMinutesAgo: 70, isVip: true },
  { name: "T-CPL", zone: "Fine Dine Section", capacity: 2, status: "reserved", tableType: "couple", tableCategory: "restaurant" },
  { name: "T-HC", zone: "Kids Friendly Zone", capacity: 4, status: "free", tableType: "high_chair", tableCategory: "restaurant" },
  { name: "T-BAR1", zone: "Sunset Lounge", capacity: 2, status: "occupied", tableType: "bar", tableCategory: "restaurant", guestCount: 2, customerName: "Suresh", occupiedMinutesAgo: 40 },
  { name: "T-WIN", zone: "Premium Indoor", capacity: 4, status: "waiting_food", tableType: "window_side", tableCategory: "restaurant", guestCount: 2, customerName: "Fatima Zahra", waiterName: "Priya Sharma", occupiedMinutesAgo: 50 },
  { name: "T-CRN", zone: "Silent Dining Zone", capacity: 4, status: "free", tableType: "corner", tableCategory: "restaurant" },
  // Outdoor tables
  { name: "G-1", zone: "Garden Seating", capacity: 4, status: "free", tableType: "garden", tableCategory: "outdoor" },
  { name: "T-12", zone: "Garden Seating", capacity: 4, status: "free", tableType: "garden", tableCategory: "outdoor" },
  { name: "R-1", zone: "Rooftop Seating", capacity: 4, status: "occupied", tableType: "rooftop", tableCategory: "outdoor", guestCount: 3, customerName: "Aisha Khan", occupiedMinutesAgo: 30 },
  { name: "P-1", zone: "Poolside Seating", capacity: 4, status: "free", tableType: "poolside", tableCategory: "outdoor" },
  { name: "B-1", zone: "Beachside Seating", capacity: 4, status: "cleaning", tableType: "beachside", tableCategory: "outdoor" },
  { name: "CAB-1", zone: "Poolside Seating", capacity: 6, status: "reserved", tableType: "cabana", tableCategory: "outdoor" },
  { name: "TR-1", zone: "Open Terrace Seating", capacity: 4, status: "free", tableType: "open_terrace", tableCategory: "outdoor" },
  // Hotel & resort tables
  { name: "R-501", zone: "Balcony Seating", capacity: 2, status: "free", tableType: "room_dining", tableCategory: "hotel_resort" },
  { name: "L-1", zone: "Sunset Lounge", capacity: 4, status: "under_service", tableType: "lounge", tableCategory: "hotel_resort" },
  { name: "CF-1", zone: "Fast Dining Section", capacity: 2, status: "free", tableType: "cafe", tableCategory: "hotel_resort" },
  { name: "BNQ-1", zone: "Banquet Section", capacity: 10, status: "blocked", tableType: "banquet", tableCategory: "hotel_resort" },
  { name: "CONF-1", zone: "Conference Dining Area", capacity: 8, status: "maintenance", tableType: "conference", tableCategory: "hotel_resort" },
  // Extra status coverage
  { name: "T-BIL", zone: "Premium Indoor", capacity: 4, status: "billing", tableType: "4_seater", tableCategory: "restaurant", guestCount: 2, customerName: "Ali Al-Mansoori", occupiedMinutesAgo: 90 },
  { name: "T-3", zone: "AC Section", capacity: 4, status: "occupied", tableType: "4_seater", tableCategory: "restaurant", guestCount: 3, customerName: "Rahul Kumar", waiterName: "Priya Sharma", occupiedMinutesAgo: 25 },
  { name: "T-7", zone: "Premium Indoor", capacity: 6, status: "occupied", tableType: "6_seater", tableCategory: "restaurant", guestCount: 5, customerName: "Ali Al-Mansoori", occupiedMinutesAgo: 55 },
];

async function ensureDemoTables(restaurantId: number, branchId: number) {
  const zoneCatalog: { name: string; areaType: string; zoneCategory: string; slug: string }[] = [
    { name: "AC Section", areaType: "indoor", zoneCategory: "indoor_dining", slug: "ac_section" },
    { name: "Premium Indoor", areaType: "indoor", zoneCategory: "indoor_dining", slug: "premium_indoor" },
    { name: "Family Section", areaType: "indoor", zoneCategory: "indoor_dining", slug: "family_section" },
    { name: "Fine Dine Section", areaType: "indoor", zoneCategory: "indoor_dining", slug: "fine_dine" },
    { name: "Fast Dining Section", areaType: "indoor", zoneCategory: "indoor_dining", slug: "fast_dining" },
    { name: "Silent Dining Zone", areaType: "indoor", zoneCategory: "indoor_dining", slug: "silent_zone" },
    { name: "Kids Friendly Zone", areaType: "indoor", zoneCategory: "indoor_dining", slug: "kids_friendly" },
    { name: "Garden Seating", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "garden_seating" },
    { name: "Rooftop Seating", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "rooftop_seating" },
    { name: "Balcony Seating", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "balcony_seating" },
    { name: "Poolside Seating", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "poolside_seating" },
    { name: "Beachside Seating", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "beachside_seating" },
    { name: "Open Terrace Seating", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "open_terrace" },
    { name: "Smoking Zone", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "smoking_zone" },
    { name: "Sunset Lounge", areaType: "outdoor", zoneCategory: "outdoor_dining", slug: "sunset_lounge" },
    { name: "VIP Lounge", areaType: "vip", zoneCategory: "special_experience", slug: "vip_lounge" },
    { name: "Private Cabin", areaType: "vip", zoneCategory: "special_experience", slug: "private_cabin" },
    { name: "Couple Cabin", areaType: "vip", zoneCategory: "special_experience", slug: "couple_cabin" },
    { name: "Corporate Dining Area", areaType: "special", zoneCategory: "special_experience", slug: "corporate_dining" },
    { name: "Banquet Section", areaType: "special", zoneCategory: "special_experience", slug: "banquet_section" },
    { name: "Conference Dining Area", areaType: "special", zoneCategory: "special_experience", slug: "conference_dining" },
    { name: "Party Zone", areaType: "special", zoneCategory: "special_experience", slug: "party_zone" },
    { name: "Live Music Zone", areaType: "special", zoneCategory: "special_experience", slug: "live_music" },
  ];

  const existingAreas = await db.select().from(tableAreasTable).where(eq(tableAreasTable.restaurantId, restaurantId));
  const areaByName = new Map(existingAreas.map(a => [a.name, a.id]));
  for (let i = 0; i < zoneCatalog.length; i++) {
    const z = zoneCatalog[i];
    if (!areaByName.has(z.name)) {
      const [area] = await db.insert(tableAreasTable).values({
        restaurantId,
        name: z.name,
        areaType: z.areaType,
        sortOrder: i,
        layoutConfig: { zoneCategory: z.zoneCategory, slug: z.slug },
      }).returning();
      areaByName.set(area.name, area.id);
    }
  }

  const legacyZoneMap: Record<string, string> = {
    "Indoor AC": "AC Section",
    "Outdoor Garden": "Garden Seating",
    "Rooftop": "Rooftop Seating",
  };

  const existing = await db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, restaurantId));
  const byName = new Map(existing.map(t => [t.name, t]));

  for (const spec of DEMO_TABLES) {
    const zoneName = legacyZoneMap[spec.zone] ?? spec.zone;
    const occupiedSince = spec.occupiedMinutesAgo
      ? new Date(Date.now() - spec.occupiedMinutesAgo * 60_000)
      : null;
    const values = {
      zone: zoneName,
      capacity: spec.capacity,
      status: spec.status,
      tableType: spec.tableType,
      tableCategory: spec.tableCategory,
      isVip: spec.isVip ?? spec.tableType === "vip",
      currentGuestCount: spec.guestCount ?? 0,
      currentCustomerName: spec.customerName ?? null,
      currentWaiterName: spec.waiterName ?? null,
      occupiedSince,
      areaId: areaByName.get(zoneName) ?? null,
      isActive: true,
    };
    if (byName.has(spec.name)) {
      await db.update(tablesMapTable).set(values).where(eq(tablesMapTable.id, byName.get(spec.name)!.id));
    } else {
      await db.insert(tablesMapTable).values({
        restaurantId,
        branchId,
        name: spec.name,
        ...values,
      });
    }
  }
  console.log("Ensured 20 demo tables with zones");
}

export async function runSeed() {
  console.log("Seeding database...");

  // 1. Super admin
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, "superadmin@fastapmenu.com"));
  let superAdmin = existing[0];
  if (!superAdmin) {
    const hash = await bcrypt.hash("Admin@123", 12);
    [superAdmin] = await db.insert(usersTable).values({ name: "Super Admin", email: "superadmin@fastapmenu.com", passwordHash: hash, role: "super_admin" }).returning();
    console.log("Created super admin");
  } else {
    console.log("Super admin already exists");
  }

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
      userId: owner.id,
      name: "Spice Garden",
      slug: "spice-garden",
      description: "Authentic flavors from the heart of South Asia. Fresh ingredients, bold spices, warm hospitality.",
      logoUrl: null,
      coverUrl: null,
      address: "123 Main Street, Dubai, UAE",
      phone: "+971 50 123 4567",
      email: "hello@spicegarden.com",
      website: "https://spicegarden.com",
      currency: "INR",
      primaryColor: "#f97316",
      businessType: "restaurant",
      timezone: "Asia/Dubai",
      isActive: true,
      plan: "pro",
    }).returning();
    console.log("Created demo restaurant");
  }

  // 4. Branch
  const existingBranch = await db.select().from(branchesTable).where(eq(branchesTable.restaurantId, restaurant.id));
  let branch = existingBranch[0];
  if (!branch) {
    [branch] = await db.insert(branchesTable).values({ restaurantId: restaurant.id, name: "Main Branch", address: "123 Main Street, Dubai", phone: "+971 50 123 4567", isActive: true }).returning();
  }

  // Update restaurant branding + digital signage (served via public API)
  await db.update(restaurantsTable).set({
    name: "The Grand Spice",
    currency: "INR",
    address: "42 MG Road, Bangalore, India",
    phone: "+91 98765 43210",
    plan: "enterprise",
    settings: {
      timezone: "Asia/Kolkata",
      subscription: {
        planId: "enterprise",
        status: "active",
        startedAt: new Date().toISOString(),
        expiresAt: null,
        trialEndsAt: null,
      },
      billing: {
        gstin: "29AABCT1234M1Z5",
        legalName: "The Grand Spice Hospitality Pvt Ltd",
        address: "42 MG Road, Bangalore, Karnataka 560001",
        upiId: "thegrandspice@upi",
      },
      signage: {
        slides: [
          { type: "promo", title: "Chef's Special Tonight", subtitle: "Butter Chicken & Naan combo", active: true, posterUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80" },
          { type: "menu", title: "Weekend Brunch", subtitle: "Unlimited starters, 11 AM - 3 PM", active: true, posterUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80" },
          { type: "promo", title: "Festival Sweets Platter", subtitle: "Limited edition desserts", active: true, posterUrl: "https://images.unsplash.com/photo-1606312619070-d48cbd4c763f?w=800&q=80" },
        ],
      },
      queue: { corporateCodes: ["CORP2024", "FASTMENU", "GRANDSPICE"] },
      kyc: {
        status: "approved",
        legalBusinessName: "The Grand Spice Hospitality Pvt Ltd",
        gstNumber: "29AABCT1234M1Z5",
        submittedAt: new Date().toISOString(),
      },
    },
    gstNumber: "29AABCT1234M1Z5",
  }).where(eq(restaurantsTable.id, restaurant.id));

  // 5. Tables (20 tables across 6 zones)
  await ensureDemoTables(restaurant.id, branch.id);

  // 6–7. Digital menu — 26 categories + full item catalog
  await ensureDigitalMenu(restaurant.id);

  const mediaItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id));
  for (const item of mediaItems) {
    if (item.name === "Chicken Tikka" && !item.videoUrl) {
      await db.update(menuItemsTable).set({
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        preview360Url: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=1200&q=80",
      }).where(eq(menuItemsTable.id, item.id));
    }
    if (item.name === "Butter Chicken" && !item.videoUrl) {
      await db.update(menuItemsTable).set({
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        preview360Url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1200&q=80",
      }).where(eq(menuItemsTable.id, item.id));
    }
  }

  const promoSeeds = [
    { code: "HAPPY20", discountType: "percent", discountValue: "20", minOrderAmount: "200", maxDiscount: "300" },
    { code: "FIRST50", discountType: "fixed", discountValue: "50", minOrderAmount: "100" },
    { code: "MEMBER10", discountType: "percent", discountValue: "10", minOrderAmount: "0" },
  ];
  for (const p of promoSeeds) {
    const existingPromo = await db.select().from(promoCodesTable).where(
      and(eq(promoCodesTable.restaurantId, restaurant.id), eq(promoCodesTable.code, p.code)),
    );
    if (!existingPromo.length) {
      await db.insert(promoCodesTable).values({ restaurantId: restaurant.id, ...p, isActive: true });
    }
  }
  console.log("Ensured promo codes");

  // 8. Staff — demo accounts per role (restaurant login role picker)
  const staffResult = await ensureDemoStaffAccounts();
  if (staffResult && (staffResult.created > 0 || staffResult.updated > 0)) {
    console.log(`Demo staff: ${staffResult.created} created, ${staffResult.updated} updated (password: ${DEMO_STAFF_PASSWORD})`);
  } else {
    console.log("Demo staff already present");
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

  // 10. Loyalty program
  const existingLoyalty = await db.select().from(loyaltyProgramsTable).where(eq(loyaltyProgramsTable.restaurantId, restaurant.id));
  if (existingLoyalty.length === 0) {
    await db.insert(loyaltyProgramsTable).values({ restaurantId: restaurant.id, isEnabled: true, type: "points", pointsPerDollar: "10", cashbackPercent: "5", stampsForReward: 10, rewardValue: "25", expiryDays: 365 });
    console.log("Created loyalty program");
  }

  // 11. Campaigns
  const existingCampaigns = await db.select().from(campaignsTable).where(eq(campaignsTable.restaurantId, restaurant.id));
  if (existingCampaigns.length === 0) {
    await db.insert(campaignsTable).values([
      { restaurantId: restaurant.id, name: "Happy Hour Special", type: "happy_hour", description: "20% off all beverages from 3PM to 6PM", discountPercent: "20", triggerType: "scheduled", startDate: "2026-05-01", endDate: "2026-06-30", isActive: true, targetSegment: null },
      { restaurantId: restaurant.id, name: "Welcome Discount", type: "discount", description: "10% off for first-time customers", discountPercent: "10", triggerType: "first_order", startDate: null, endDate: null, isActive: true, targetSegment: "new" },
      { restaurantId: restaurant.id, name: "VIP Cashback", type: "discount", description: "15% cashback for VIP customers", discountPercent: "15", triggerType: "manual", startDate: null, endDate: null, isActive: false, targetSegment: "vip" },
    ]);
    console.log("Created campaigns");
  }

  // 12. Reservations (optional — skip if legacy schema)
  try {
  const existingRes = await db.select().from(reservationsTable).where(eq(reservationsTable.restaurantId, restaurant.id));
  if (existingRes.length === 0) {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    await db.insert(reservationsTable).values([
      { restaurantId: restaurant.id, customerName: "Ali Al-Mansoori", customerPhone: "+971501234001", customerEmail: "ali@example.com", date: today, time: "19:00", guestCount: 4, status: "confirmed", reservationType: "table", zone: "window_side", bookingToken: "#REV0001", depositAmount: "500", depositStatus: "paid", notes: "Window table preferred" },
      { restaurantId: restaurant.id, customerName: "Fatima Zahra", customerPhone: "+971501234002", customerEmail: "fatima@example.com", date: today, time: "20:30", guestCount: 2, status: "pending", reservationType: "vip", zone: "vip-lounge", bookingToken: "#REV0002", depositAmount: "1000", depositStatus: "pending", specialRequest: "Anniversary dinner" },
      { restaurantId: restaurant.id, customerName: "Corporate Booking", customerPhone: "+971507654321", customerEmail: "corp@example.com", date: tomorrow, time: "13:00", guestCount: 12, status: "confirmed", reservationType: "conference", zone: "conference-room", bookingToken: "#REV0003", depositAmount: "2000", depositStatus: "paid", notes: "Projector & whiteboard" },
      { restaurantId: restaurant.id, customerName: "James Smith", customerPhone: "+971501234003", customerEmail: "james@example.com", date: tomorrow, time: "18:30", guestCount: 3, status: "confirmed", reservationType: "table", bookingToken: "#REV0004", depositAmount: "500", depositStatus: "paid" },
      { restaurantId: restaurant.id, customerName: "Pool Party", customerPhone: "+971501234004", date: tomorrow, time: "14:00", guestCount: 6, status: "pending", reservationType: "pool", zone: "poolside", bookingToken: "#REV0005", depositAmount: "300", depositStatus: "pending" },
      { restaurantId: restaurant.id, customerName: "Banquet Event", customerPhone: "+971501234005", date: tomorrow, time: "18:00", guestCount: 80, status: "confirmed", reservationType: "banquet", zone: "banquet-hall", bookingToken: "#REV0006", depositAmount: "10000", depositStatus: "paid", specialRequest: "Celebration event" },
      { restaurantId: restaurant.id, customerName: "Cabana Guest", customerPhone: "+971501234006", date: today, time: "12:00", guestCount: 4, status: "confirmed", reservationType: "cabana", zone: "poolside", bookingToken: "#REV0007", depositAmount: "1500", depositStatus: "paid" },
      { restaurantId: restaurant.id, customerName: "Hall Booking", customerPhone: "+971501234007", date: tomorrow, time: "11:00", guestCount: 40, status: "pending", reservationType: "hall", zone: "banquet-hall", bookingToken: "#REV0008", depositAmount: "5000", depositStatus: "pending" },
      { restaurantId: restaurant.id, customerName: "Bar Guest", customerPhone: "+971501234008", date: today, time: "21:00", guestCount: 2, status: "confirmed", reservationType: "bar_table", zone: "Sunset Lounge", bookingToken: "#BAR0001", depositAmount: "300", depositStatus: "paid", notes: "Bar table: Window Bar T-3" },
      { restaurantId: restaurant.id, customerName: "VIP Lounge Party", customerPhone: "+971501234009", date: tomorrow, time: "22:00", guestCount: 6, status: "confirmed", reservationType: "lounge", zone: "vip_lounge", bookingToken: "#LOUNGE001", depositAmount: "2000", depositStatus: "pending", notes: "Premium lounge: VIP Premium Lounge. Min spend INR 5000" },
    ]);
    console.log("Created reservations");
  }
  } catch (e) {
    console.warn("Reservations seed skipped:", (e as Error).message);
  }

  // 13. Sample feedback
  const existingFeedback = await db.select().from(feedbackTable).where(eq(feedbackTable.restaurantId, restaurant.id));
  if (existingFeedback.length === 0) {
    await db.insert(feedbackTable).values([
      { restaurantId: restaurant.id, customerName: "Ali Al-Mansoori", rating: 5, foodRating: 5, serviceRating: 4, ambienceRating: 5, comment: "Absolutely love the Chicken Biryani here. Best in Dubai!" },
      { restaurantId: restaurant.id, customerName: "Fatima Zahra", rating: 4, foodRating: 4, serviceRating: 5, ambienceRating: 4, comment: "Great service, food was delicious. Will definitely come back." },
      { restaurantId: restaurant.id, customerName: "James Smith", rating: 5, foodRating: 5, serviceRating: 5, ambienceRating: 4, comment: "The Butter Chicken is outstanding. Highly recommend!" },
      { restaurantId: restaurant.id, customerName: "Aisha Khan", rating: 3, foodRating: 3, serviceRating: 4, ambienceRating: 3, comment: "Food was good but took a while to arrive. The naan was excellent though." },
    ]);
    console.log("Created feedback");
  }

  // 14. Active table orders linked to occupied tables
  const tables = await db.select().from(tablesMapTable).where(eq(tablesMapTable.restaurantId, restaurant.id));
  const tableByName = Object.fromEntries(tables.map(t => [t.name, t]));
  const menuItems = await db.select().from(menuItemsTable).where(eq(menuItemsTable.restaurantId, restaurant.id));
  const pizza = menuItems.find(m => m.name.includes("Pizza") || m.name.includes("Tikka")) ?? menuItems[1];
  const dal = menuItems.find(m => m.name.includes("Dal")) ?? menuItems[5];
  const biryani = menuItems.find(m => m.name.includes("Biryani")) ?? menuItems[8];

  // Kitchen-visible statuses only (pending/confirmed/preparing/ready) — served/billed orders are hidden on KDS
  const activeOrderSpecs: { tableName: string; customerName: string; itemName: string; item: typeof menuItems[0]; qty: number; total: number; status: string }[] = [
    { tableName: "T-3", customerName: "Rahul Kumar", itemName: "Margherita Pizza", item: pizza, qty: 2, total: 380, status: "pending" },
    { tableName: "T-4A", customerName: "Rahul Kumar", itemName: dal.name, item: dal, qty: 2, total: 680, status: "preparing" },
    { tableName: "T-7", customerName: "Ali Al-Mansoori", itemName: biryani.name, item: biryani, qty: 3, total: 520, status: "preparing" },
    { tableName: "T-FAM", customerName: "James Smith", itemName: biryani.name, item: biryani, qty: 4, total: 890, status: "confirmed" },
    { tableName: "T-VIP", customerName: "Noor Al-Ahmad", itemName: biryani.name, item: biryani, qty: 2, total: 1200, status: "preparing" },
    { tableName: "T-BAR1", customerName: "Suresh", itemName: pizza.name, item: pizza, qty: 2, total: 450, status: "ready" },
    { tableName: "T-WIN", customerName: "Fatima Zahra", itemName: pizza.name, item: pizza, qty: 2, total: 450, status: "pending" },
    { tableName: "R-1", customerName: "Aisha Khan", itemName: dal.name, item: dal, qty: 2, total: 310, status: "preparing" },
    { tableName: "T-BIL", customerName: "Ali Al-Mansoori", itemName: biryani.name, item: biryani, qty: 2, total: 520, status: "ready" },
  ];

  for (const spec of activeOrderSpecs) {
    const table = tableByName[spec.tableName];
    if (!table || !spec.item) continue;
    const subtotal = spec.total / 1.05;
    const tax = spec.total - subtotal;
    const existing = await db.select().from(ordersTable).where(
      and(eq(ordersTable.restaurantId, restaurant.id), eq(ordersTable.tableId, table.id)),
    );
    const items = [{ menuItemId: spec.item.id, name: spec.itemName, price: parseFloat(spec.item.price), quantity: spec.qty, subtotal: subtotal }];
    if (existing.length > 0) {
      const [order] = await db.update(ordersTable).set({
        customerName: spec.customerName,
        status: spec.status,
        items,
        subtotal: String(subtotal.toFixed(2)),
        tax: String(tax.toFixed(2)),
        total: String(spec.total.toFixed(2)),
        paymentStatus: ["served", "billing", "completed", "delivered"].includes(spec.status) ? "paid" : "pending",
        guestCount: table.currentGuestCount ?? 2,
        waiterName: spec.status === "ready" ? null : table.currentWaiterName,
        orderSource: "qr",
      }).where(eq(ordersTable.id, existing[0].id)).returning();
      await db.update(tablesMapTable).set({ currentOrderId: order.id }).where(eq(tablesMapTable.id, table.id));
    } else {
      const [order] = await db.insert(ordersTable).values({
        restaurantId: restaurant.id,
        tableId: table.id,
        tableName: spec.tableName,
        customerName: spec.customerName,
        type: "dine_in",
        status: spec.status,
        items,
        subtotal: String(subtotal.toFixed(2)),
        tax: String(tax.toFixed(2)),
        total: String(spec.total.toFixed(2)),
        paymentStatus: ["served", "billing", "completed", "delivered"].includes(spec.status) ? "paid" : "pending",
        guestCount: table.currentGuestCount ?? 2,
        waiterName: spec.status === "ready" ? null : table.currentWaiterName,
        orderSource: "qr",
        branchId: branch.id,
      }).returning();
      await db.update(tablesMapTable).set({ currentOrderId: order.id }).where(eq(tablesMapTable.id, table.id));
    }
  }
  console.log("Linked active orders to occupied tables");

  // 15. Demo hotel rooms with smart controls
  const demoRooms = [
    { number: "501", type: "deluxe", floor: 5, status: "occupied", guestName: "James Smith" },
    { number: "502", type: "standard", floor: 5, status: "vacant" },
    { number: "503", type: "suite", floor: 5, status: "cleaning", guestName: null },
  ];
  for (const spec of demoRooms) {
    const existing = await db.select().from(hotelRoomsTable).where(
      and(eq(hotelRoomsTable.restaurantId, restaurant.id), eq(hotelRoomsTable.number, spec.number)),
    );
    if (existing.length === 0) {
      await db.insert(hotelRoomsTable).values({
        restaurantId: restaurant.id,
        number: spec.number,
        type: spec.type,
        floor: spec.floor,
        status: spec.status,
        guestName: spec.guestName,
        roomControls: {
          ...DEFAULT_ROOM_CONTROLS,
          cleaningStatus: spec.status === "cleaning" ? "in_progress" : spec.status === "occupied" ? "clean" : "scheduled",
        },
      });
    }
  }
  console.log("Ensured demo hotel rooms");

  // 16. Demo queue / waitlist entries
  const existingQueue = await db.select().from(queueEntriesTable).where(eq(queueEntriesTable.restaurantId, restaurant.id));
  if (existingQueue.length === 0) {
    const demoQueue = [
      { tokenNumber: 1, guestName: "Sharma Family", guestPhone: "+919876500001", partySize: 4, priority: "family", queueType: "family", estimatedWait: 18, notifyVia: "sms" },
      { tokenNumber: 2, guestName: "Rahul Mehta", guestPhone: "+919876500002", partySize: 2, priority: "normal", queueType: "dining", estimatedWait: 12, notifyVia: "app" },
      { tokenNumber: 3, guestName: "VIP Guest", guestPhone: "+919876500003", partySize: 2, priority: "vip", queueType: "vip", estimatedWait: 5, notifyVia: "whatsapp" },
      { tokenNumber: 4, guestName: "Corp Team", guestPhone: "+919876500004", partySize: 6, priority: "corporate", queueType: "corporate", estimatedWait: 10, notifyVia: "both" },
      { tokenNumber: 5, guestName: "Gold Member", guestPhone: "+919876500005", partySize: 3, priority: "membership_gold", queueType: "membership", estimatedWait: 8, notifyVia: "sms" },
    ];
    for (const q of demoQueue) {
      await db.insert(queueEntriesTable).values({
        restaurantId: restaurant.id,
        ...q,
        publicToken: `demo_${q.tokenNumber}_${Date.now()}`,
        status: "waiting",
      });
    }
    console.log(`Created ${demoQueue.length} demo queue entries`);
  }

  // 17. Demo banquet / events (all 8 types)
  const existingEvents = await db.select().from(banquetEventsTable).where(eq(banquetEventsTable.restaurantId, restaurant.id));
  if (existingEvents.length === 0) {
    const eventDate = new Date(Date.now() + 30 * 86400000);
    const demoEvents = [
      { name: "Sharma Wedding Reception", type: "wedding", guestCount: 250, venue: "Grand Banquet Hall", status: "confirmed", totalAmount: "485000", advancePaid: "145500", metadata: { hallId: "grand_hall", seatingLayout: "banquet", cateringPackageId: "royal", decorationPackageId: "wedding", enquiryToken: "EVT-WED001" } },
      { name: "Rahul's 30th Birthday", type: "birthday", guestCount: 60, venue: "Banquet Hall B", status: "enquiry", totalAmount: "95000", metadata: { hallId: "banquet_b", seatingLayout: "cocktail", cateringPackageId: "standard", decorationPackageId: "theme" } },
      { name: "Kapoor Engagement", type: "engagement", guestCount: 120, venue: "Grand Banquet Hall", status: "tentative", totalAmount: "220000", metadata: { hallId: "grand_hall", seatingLayout: "banquet", decorationPackageId: "floral" } },
      { name: "TechCorp Annual Gala", type: "corporate", guestCount: 180, venue: "Conference Hall B", status: "confirmed", totalAmount: "310000", metadata: { hallId: "conference_b", seatingLayout: "theatre", cateringPackageId: "premium", decorationPackageId: "corporate" } },
      { name: "Hospitality Summit 2026", type: "conference", guestCount: 150, venue: "Conference Hall A", status: "confirmed", totalAmount: "185000", metadata: { hallId: "conference_a", seatingLayout: "classroom", cateringPackageId: "basic" } },
      { name: "Sunset Cocktail Evening", type: "cocktail", guestCount: 80, venue: "Rooftop Garden", status: "enquiry", totalAmount: "142000", metadata: { hallId: "rooftop", seatingLayout: "cocktail", cateringPackageId: "cocktail_bites", decorationPackageId: "minimal" } },
      { name: "Summer Pool Party", type: "pool_party", guestCount: 50, venue: "Pool Deck", status: "enquiry", totalAmount: "78000", metadata: { hallId: "pool_deck", seatingLayout: "poolside", cateringPackageId: "pool_bbq", decorationPackageId: "pool_party" } },
      { name: "Jazz Night Live", type: "live_music", guestCount: 90, venue: "Rooftop Garden", status: "tentative", totalAmount: "195000", metadata: { hallId: "rooftop", seatingLayout: "theatre", cateringPackageId: "cocktail_bites", decorationPackageId: "live_music" } },
      { name: "Friday Night DJ — DJ Aakash", type: "dj_event", guestCount: 120, venue: "Sunset Lounge / Dance Floor", status: "confirmed", totalAmount: "60000", advancePaid: "500", metadata: { djEventId: "dj_friday", genre: "Bollywood & EDM", coverCharge: 500 } },
      { name: "Saturday Groove — DJ Nina", type: "dj_event", guestCount: 150, venue: "Sunset Lounge / Dance Floor", status: "confirmed", totalAmount: "75000", metadata: { djEventId: "dj_saturday", genre: "House & Latin", coverCharge: 500 } },
    ];
    for (const ev of demoEvents) {
      await db.insert(banquetEventsTable).values({
        restaurantId: restaurant.id,
        name: ev.name,
        type: ev.type,
        eventDate,
        eventTime: "18:00",
        guestCount: ev.guestCount,
        venue: ev.venue,
        status: ev.status,
        totalAmount: ev.totalAmount,
        advancePaid: ev.advancePaid ?? "0",
        contactName: "Demo Contact",
        contactPhone: "+971501234000",
        catering: true,
        decor: true,
        metadata: ev.metadata,
      });
    }
    console.log(`Created ${demoEvents.length} demo banquet events`);
  }

  // 18. Spa & wellness services
  const existingSpa = await db.select().from(spaServicesTable).where(eq(spaServicesTable.restaurantId, restaurant.id));
  if (existingSpa.length === 0) {
    const spaSeed = [
      { name: "Swedish Massage", category: "massage", duration: 60, price: "2500", description: "Classic relaxation massage", therapist: "Priya Sharma" },
      { name: "Deep Tissue Massage", category: "massage", duration: 60, price: "2800", description: "Targeted muscle relief", therapist: "Ahmed Al-Rashid" },
      { name: "Aromatherapy Facial", category: "facial", duration: 45, price: "1800", description: "Rejuvenating facial", therapist: "Meera Patel" },
      { name: "Couple Spa Retreat", category: "couple", duration: 90, price: "5500", description: "Side-by-side massage for two", therapist: "Priya Sharma" },
      { name: "Hot Stone Therapy", category: "body", duration: 75, price: "3200", description: "Heated stone treatment", therapist: "Ahmed Al-Rashid" },
      { name: "Morning Yoga Flow", category: "yoga", duration: 60, price: "800", description: "Vinyasa for all levels", therapist: "Sana Khan" },
      { name: "Sunset Yoga", category: "yoga", duration: 45, price: "600", description: "Relaxing evening yoga", therapist: "Sana Khan" },
      { name: "Personal Gym Session", category: "gym", duration: 60, price: "1200", description: "1-on-1 trainer", therapist: "Ahmed Al-Rashid" },
      { name: "Group Gym Access", category: "gym", duration: 90, price: "500", description: "Full gym floor", therapist: "Any" },
      { name: "Guided Meditation", category: "meditation", duration: 45, price: "500", description: "Mindfulness session", therapist: "Sana Khan" },
      { name: "Sound Bath Meditation", category: "meditation", duration: 60, price: "900", description: "Healing sound therapy", therapist: "Sana Khan" },
      { name: "Ayurvedic Wellness", category: "wellness", duration: 90, price: "3500", description: "Ayurveda consultation + therapy", therapist: "Raj Kumar" },
      { name: "Reflexology Therapy", category: "wellness", duration: 45, price: "1500", description: "Pressure point therapy", therapist: "Raj Kumar" },
    ];
    for (const s of spaSeed) {
      await db.insert(spaServicesTable).values({ restaurantId: restaurant.id, ...s, isAvailable: true });
    }
    console.log(`Created ${spaSeed.length} spa & wellness services`);
  }

  // 19. Demo guest user with multi-wallet balances
  const demoPhone = "9876543210";
  const demoGuestEmail = "rahul@example.com";
  const demoPasswordHash = await bcrypt.hash("Demo@123", 10);
  const guestPayload = {
    phone: demoPhone,
    email: demoGuestEmail,
    name: "Rahul Sharma",
    passwordHash: demoPasswordHash,
    tier: "gold" as const,
    isGuest: false,
    loginProvider: "otp" as const,
    walletBalance: "850.00",
    cashbackBalance: "120.00",
    walletBuckets: {
      main: "850.00",
      cashback: "120.00",
      refund: "250.00",
      reward: "180.00",
      gift: "500.00",
      membership: "1000.00",
    },
    loyaltyPoints: "1240",
    birthday: "1990-06-15",
    anniversary: "2018-03-22",
    rewardsMeta: { diningCredits: 350, birthdayClaimedYear: null, anniversaryClaimedYear: null },
  };
  let [demoGuest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.phone, demoPhone));
  if (!demoGuest) {
    const byEmail = await db.select().from(guestUsersTable).where(eq(guestUsersTable.email, demoGuestEmail));
    demoGuest = byEmail[0];
  }
  if (demoGuest) {
    [demoGuest] = await db.update(guestUsersTable).set(guestPayload).where(eq(guestUsersTable.id, demoGuest.id)).returning();
    console.log("Updated demo guest user with wallets");
  } else {
    [demoGuest] = await db.insert(guestUsersTable).values(guestPayload).returning();
    console.log("Created demo guest user with wallets");
  }

  if (demoGuest) {
    try {
      const existingTx = await db.select().from(walletTransactionsTable).where(eq(walletTransactionsTable.guestUserId, demoGuest.id));
      if (existingTx.length === 0) {
        const demoTx = [
          { type: "recharge", walletType: "main", amount: "500.00", balanceAfter: "850.00", description: "Wallet recharge via UPI" },
          { type: "cashback", walletType: "cashback", amount: "45.00", balanceAfter: "120.00", description: "5% cashback — Order #1234", referenceId: "ORD-1234" },
          { type: "payment", walletType: "main", amount: "-320.00", balanceAfter: "530.00", description: "Payment — The Grand Spice" },
          { type: "refund", walletType: "refund", amount: "250.00", balanceAfter: "250.00", description: "Refund — Cancelled order #1220", referenceId: "ORD-1220" },
          { type: "reward_redeem", walletType: "reward", amount: "180.00", balanceAfter: "180.00", description: "Points redeemed — 1800 pts" },
          { type: "gift_credit", walletType: "gift", amount: "500.00", balanceAfter: "500.00", description: "Gift card — BDAY2026" },
          { type: "membership_credit", walletType: "membership", amount: "1000.00", balanceAfter: "1000.00", description: "Gold membership welcome credit" },
          { type: "transfer", walletType: "main", amount: "100.00", balanceAfter: "850.00", description: "Transfer from cashback", metadata: { from: "cashback", to: "main" } },
        ];
        for (const tx of demoTx) {
          await db.insert(walletTransactionsTable).values({
            guestUserId: demoGuest.id,
            restaurantId: restaurant.id,
            ...tx,
          });
        }
        console.log(`Created ${demoTx.length} demo wallet transactions`);
      }
    } catch (walletErr) {
      console.warn("Wallet transactions seed skipped (run db-sync-critical.sql):", walletErr instanceof Error ? walletErr.message : walletErr);
    }

    const [demoCustomer] = await db.select().from(customersTable).where(
      and(eq(customersTable.restaurantId, restaurant.id), eq(customersTable.phone, demoPhone)),
    );
    let loyaltyCustomer = demoCustomer;
    if (!loyaltyCustomer) {
      [loyaltyCustomer] = await db.insert(customersTable).values({
        restaurantId: restaurant.id,
        name: "Rahul Sharma",
        phone: demoPhone,
        email: "rahul@example.com",
        totalOrders: 18,
        totalSpend: "12400",
        loyaltyPoints: 1240,
        birthday: "1990-06-15",
        anniversary: "2018-03-22",
        segment: "regular",
      }).returning();
    }
    if (loyaltyCustomer) {
      const existingLoyaltyTx = await db.select().from(loyaltyTransactionsTable).where(
        eq(loyaltyTransactionsTable.customerId, loyaltyCustomer.id),
      );
      if (existingLoyaltyTx.length === 0) {
        const loyaltyTx = [
          { type: "earn", points: 118, cashback: "59.00", orderId: null },
          { type: "earn", points: 46, cashback: "23.00", orderId: null },
          { type: "redeem", points: -200, cashback: "0" },
          { type: "birthday", points: 0, cashback: "0" },
          { type: "anniversary", points: 0, cashback: "0" },
        ];
        for (const tx of loyaltyTx) {
          await db.insert(loyaltyTransactionsTable).values({
            restaurantId: restaurant.id,
            customerId: loyaltyCustomer.id,
            ...tx,
          });
        }
        console.log(`Created ${loyaltyTx.length} demo loyalty transactions`);
      }
    }
  }

  const existingAudit = await db.select().from(auditLogsTable).where(eq(auditLogsTable.restaurantId, restaurant.id));
  if (existingAudit.length === 0) {
    await db.insert(auditLogsTable).values([
      { restaurantId: restaurant.id, action: "Staff Login", category: "auth", severity: "info", performedBy: "Priya Sharma", role: "manager", details: { summary: "Manager logged in from POS" } },
      { restaurantId: restaurant.id, action: "Menu Updated", category: "menu", severity: "info", performedBy: "Demo Owner", role: "owner", details: { summary: "Butter Chicken price updated" } },
      { restaurantId: restaurant.id, action: "Discount Applied", category: "billing", severity: "high", performedBy: "Ahmed Al-Rashidi", role: "manager", details: { summary: "20% discount on Table T-12", table: "T-12" } },
      { restaurantId: restaurant.id, action: "Database query slow on analytics", category: "system", severity: "warning", performedBy: "System", role: "system", details: { summary: "Query exceeded 5000ms" } },
      { restaurantId: restaurant.id, action: "Payment gateway timeout", category: "finance", severity: "critical", performedBy: "System", role: "system", details: { summary: "Razorpay webhook delayed" } },
    ]);
    console.log("Created demo audit logs");
  }

  const existingSuppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.restaurantId, restaurant.id));
  if (existingSuppliers.length === 0) {
    const supplierRows = await db.insert(suppliersTable).values([
      { restaurantId: restaurant.id, name: "FreshMart Distributors", contactPerson: "Ramesh Gupta", phone: "+91 98765 20001", email: "freshmart@email.com", category: "Poultry & Dairy", rating: 5, paymentTerms: "7 days", creditLimit: "50000", outstandingBalance: "19600" },
      { restaurantId: restaurant.id, name: "Royal Spices Co.", contactPerson: "Priya Sharma", phone: "+91 98765 20002", email: "royalspices@email.com", category: "Spices & Dry Goods", rating: 5, paymentTerms: "15 days", creditLimit: "30000", outstandingBalance: "6900" },
      { restaurantId: restaurant.id, name: "AgroFresh Veggies", contactPerson: "Kiran Patel", phone: "+91 98765 20003", email: "agrofresh@email.com", category: "Fresh Vegetables", rating: 4, paymentTerms: "3 days", creditLimit: "20000", outstandingBalance: "3650" },
    ]).returning();
    console.log("Created suppliers");

    const existingPOs = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.restaurantId, restaurant.id));
    if (existingPOs.length === 0 && supplierRows[0]) {
      await db.insert(purchaseOrdersTable).values([
        { restaurantId: restaurant.id, supplierId: supplierRows[0].id, supplierName: supplierRows[0].name, poNumber: "PO-2026-001", status: "received", items: [{ name: "Chicken (Frozen)", quantity: 50, unitPrice: 280 }], subtotal: "14000", tax: "700", total: "14700", deliveredAt: new Date() },
        { restaurantId: restaurant.id, supplierId: supplierRows[1]?.id, supplierName: supplierRows[1]?.name || "Royal Spices Co.", poNumber: "PO-2026-002", status: "sent", items: [{ name: "Biryani Masala", quantity: 10, unitPrice: 480 }], subtotal: "4800", tax: "240", total: "5040", expectedDelivery: new Date(Date.now() + 2 * 86400000) },
        { restaurantId: restaurant.id, supplierId: supplierRows[2]?.id, supplierName: supplierRows[2]?.name || "AgroFresh Veggies", poNumber: "PO-2026-003", status: "draft", items: [{ name: "Tomatoes", quantity: 30, unitPrice: 40 }], subtotal: "1200", tax: "60", total: "1260" },
      ]);
      console.log("Created purchase orders");
    }
  }

  const existingTasks = await db.select().from(tasksTable).where(eq(tasksTable.restaurantId, restaurant.id));
  if (existingTasks.length === 0) {
    await db.insert(tasksTable).values([
      { restaurantId: restaurant.id, title: "Restock chicken inventory", description: "Order 25kg before weekend rush", category: "general", priority: "high", assignedTo: "Mohammed Hassan", assignedRole: "kitchen", status: "pending" },
      { restaurantId: restaurant.id, title: "Update weekend specials board", category: "service", priority: "normal", assignedTo: "Priya Sharma", assignedRole: "manager", status: "pending" },
      { restaurantId: restaurant.id, title: "Clean exhaust filters", category: "cleaning", priority: "normal", assignedTo: "Sunita Devi", assignedRole: "housekeeping", status: "completed", completedAt: new Date() },
    ]);
    console.log("Created tasks");
  }

  const existingSop = await db.select().from(sopItemsTable).where(eq(sopItemsTable.restaurantId, restaurant.id));
  if (existingSop.length === 0) {
    await db.insert(sopItemsTable).values([
      { restaurantId: restaurant.id, title: "Food Safety & Hygiene Standards", category: "safety", content: "Complete guide for food handling, storage temperatures, and cross-contamination prevention.", steps: ["Wash hands", "Check fridge temps", "Label all prep items"], assignedRoles: ["kitchen", "manager"] },
      { restaurantId: restaurant.id, title: "Customer Service Guidelines", category: "service", content: "Greeting standards, complaint handling, and table service etiquette.", steps: ["Greet within 30 seconds", "Confirm order", "Check back after 5 minutes"], assignedRoles: ["waiter", "manager"] },
      { restaurantId: restaurant.id, title: "Cash Handling & POS Operations", category: "finance", content: "Opening float, cash drops, and end-of-day reconciliation.", steps: ["Count opening float", "Run Z-report", "Deposit excess cash"], assignedRoles: ["cashier"] },
    ]);
    console.log("Created SOP documents");
  }

  const existingShifts = await db.select().from(cashShiftsTable).where(eq(cashShiftsTable.restaurantId, restaurant.id));
  if (existingShifts.length === 0) {
    await db.insert(cashShiftsTable).values([
      { restaurantId: restaurant.id, staffName: "Sara Johnson", staffRole: "cashier", openingBalance: "5000", closingBalance: "23400", expectedBalance: "24100", cashSales: "19800", cashExpenses: "700", status: "closed", closedAt: new Date(Date.now() - 86400000) },
      { restaurantId: restaurant.id, staffName: "Sara Johnson", staffRole: "cashier", openingBalance: "23400", cashSales: "8200", cashExpenses: "0", status: "open" },
    ]);
    await db.insert(financeTransactionsTable).values([
      { restaurantId: restaurant.id, type: "income", category: "sales", description: "Table T-12 cash payment", amount: "1240", paymentMethod: "cash", performedBy: "Sara Johnson" },
      { restaurantId: restaurant.id, type: "income", category: "sales", description: "Takeaway cash payment", amount: "560", paymentMethod: "cash", performedBy: "Sara Johnson" },
      { restaurantId: restaurant.id, type: "expense", category: "supplies", description: "Vegetable purchase", amount: "450", paymentMethod: "cash", performedBy: "Sara Johnson" },
    ]);
    console.log("Created cash shifts & finance transactions");
  }

  await setSettingsSection(restaurant.id, "franchise", {
    franchisees: [
      { id: "F01", name: "Mehta Restaurant Group", branch: "Bandra West", owner: "Vikram Mehta", royalty: 14200, status: "paid", dueDate: "Jan 1, 2026", contract: "Feb 2027", phone: "+91 98765 12345" },
      { id: "F02", name: "Sharma Foods Pvt Ltd", branch: "Salt Lake", owner: "Priya Sharma", royalty: 9800, status: "due", dueDate: "Dec 15, 2025", contract: "Sep 2026", phone: "+91 98765 67890" },
    ],
  });
  await setSettingsSection(restaurant.id, "stockTransfers", {
    transfers: [
      { id: "TR001", from: "Main Branch", to: "Salt Lake", items: "Basmati Rice (25kg), Ghee (5kg)", status: "in-transit", date: "Today", requestedBy: "Suresh Kumar", value: 3400 },
      { id: "TR002", from: "Koramangala", to: "Bandra West", items: "Saffron (100g), Premium Spices", status: "completed", date: "Yesterday", requestedBy: "Anjali Desai", value: 1800 },
    ],
  });
  await setSettingsSection(restaurant.id, "giftCards", {
    cards: [
      { code: "GC-2601", amount: 1000, remaining: 600, purchasedBy: "Rahul Mehta", status: "active", expiry: "Dec 2026" },
      { code: "GC-2602", amount: 2000, remaining: 2000, purchasedBy: "Priya Sharma", status: "active", expiry: "Mar 2026" },
      { code: "GC-2603", amount: 500, remaining: 0, purchasedBy: "Amit Kumar", status: "redeemed", expiry: "Oct 2025" },
    ],
  });
  console.log("Ensured franchise, stock transfers & gift cards settings");

  await setSettingsSection(restaurant.id, "hardware", [
    { id: 101, type: "kiosk", name: "Kiosk #1", model: "Sunmi K2", serial: "SN-KSK-001", location: "Near Entrance", status: "online", last_ping: new Date().toISOString(), ip: "192.168.1.20", firmware: "v1.2.0", notes: "", orderCount: 24 },
    { id: 102, type: "kiosk", name: "Kiosk #2", model: "Sunmi K2", serial: "SN-KSK-002", location: "Centre Floor", status: "online", last_ping: new Date().toISOString(), ip: "192.168.1.21", firmware: "v1.2.0", notes: "", orderCount: 18 },
    { id: 103, type: "kiosk", name: "Kiosk #3", model: "Sunmi K2", serial: "SN-KSK-003", location: "Outdoor Area", status: "offline", last_ping: new Date(Date.now() - 3 * 3600000).toISOString(), ip: "192.168.1.22", firmware: "v1.2.0", notes: "", orderCount: 5 },
    { id: 1, type: "pos", name: "Main POS Terminal", model: "Sunmi T2", serial: "SN-POS-001", location: "Counter", status: "online", last_ping: new Date().toISOString(), ip: "192.168.1.10", firmware: "v2.3.1", notes: "" },
    { id: 2, type: "printer", name: "Kitchen Thermal Printer", model: "Epson TM-T88", serial: "SN-PRT-001", location: "Kitchen", status: "online", last_ping: new Date().toISOString(), ip: "192.168.1.11", firmware: "v1.8.0", notes: "" },
  ]);
  console.log("Ensured hardware devices (kiosks + POS)");

  await setSettingsSection(restaurant.id, "trainingVideos", [
    { id: "V01", title: "POS System Training — Complete Guide", duration: "18 min", category: "operations", views: 12, completions: 8, level: "required", thumbnail: "POS", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { id: "V02", title: "Food Safety: Handling Raw & Cooked Items", duration: "12 min", category: "safety", views: 16, completions: 15, level: "required", thumbnail: "FOOD", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { id: "V03", title: "Customer Greeting & Table Etiquette", duration: "8 min", category: "service", views: 14, completions: 11, level: "required", thumbnail: "SVC", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { id: "V04", title: "How to Handle Customer Complaints", duration: "10 min", category: "service", views: 10, completions: 7, level: "recommended", thumbnail: "CHAT", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { id: "V05", title: "Fire Extinguisher & Emergency Procedures", duration: "6 min", category: "safety", views: 18, completions: 18, level: "required", thumbnail: "SAFE", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { id: "V06", title: "Upselling & Revenue-Building Techniques", duration: "15 min", category: "sales", views: 8, completions: 4, level: "recommended", thumbnail: "SALE", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  ]);
  console.log("Ensured training videos");

  const existingInventory = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.restaurantId, restaurant.id));
  if (existingInventory.length === 0) {
    await db.insert(inventoryItemsTable).values([
      { restaurantId: restaurant.id, name: "Chicken Breast", category: "poultry", unit: "kg", currentStock: "8.5", minStock: "15", maxStock: "50", costPerUnit: "280", supplier: "FreshMart Distributors", location: "Cold Store A", expiryDate: new Date(Date.now() + 3 * 86400000) },
      { restaurantId: restaurant.id, name: "Basmati Rice", category: "grains", unit: "kg", currentStock: "42", minStock: "20", maxStock: "100", costPerUnit: "95", supplier: "Royal Spices Co.", location: "Dry Store" },
      { restaurantId: restaurant.id, name: "Tomatoes", category: "vegetables", unit: "kg", currentStock: "6", minStock: "10", maxStock: "30", costPerUnit: "40", supplier: "AgroFresh Veggies", location: "Veg Prep", expiryDate: new Date(Date.now() + 2 * 86400000) },
      { restaurantId: restaurant.id, name: "Ghee", category: "dairy", unit: "kg", currentStock: "12", minStock: "5", maxStock: "25", costPerUnit: "520", supplier: "FreshMart Distributors", location: "Cold Store B" },
      { restaurantId: restaurant.id, name: "Saffron", category: "spices", unit: "g", currentStock: "45", minStock: "20", maxStock: "100", costPerUnit: "12", supplier: "Royal Spices Co.", location: "Spice Vault" },
    ]);
    console.log("Created demo inventory items");
  }

  const existingHk = await db.select().from(housekeepingTasksTable).where(eq(housekeepingTasksTable.restaurantId, restaurant.id));
  if (existingHk.length === 0) {
    await db.insert(housekeepingTasksTable).values([
      { restaurantId: restaurant.id, type: "cleaning", title: "Room 501 turnover", location: "Floor 5", roomNumber: "501", priority: "high", status: "in_progress", assignedTo: "HK Supervisor", scheduledAt: new Date() },
      { restaurantId: restaurant.id, type: "linen", title: "Replace pool towels", location: "Poolside", priority: "normal", status: "pending", assignedTo: "Sunita Devi" },
      { restaurantId: restaurant.id, type: "inspection", title: "VIP suite inspection", location: "Penthouse", roomNumber: "PH-1", priority: "urgent", status: "pending", assignedTo: "HK Supervisor" },
      { restaurantId: restaurant.id, type: "cleaning", title: "Lobby deep clean", location: "Main Lobby", priority: "normal", status: "completed", assignedTo: "Sunita Devi", completedAt: new Date() },
    ]);
    console.log("Created demo housekeeping tasks");
  }

  const existingMaintenance = await db.select().from(maintenanceRequestsTable).where(eq(maintenanceRequestsTable.restaurantId, restaurant.id));
  if (existingMaintenance.length === 0) {
    await db.insert(maintenanceRequestsTable).values([
      { restaurantId: restaurant.id, title: "AC unit noise — Room 502", description: "Guest reported rattling", location: "Room 502", category: "hvac", priority: "high", status: "open", reportedBy: "Front Desk" },
      { restaurantId: restaurant.id, title: "Lobby light replacement", description: "Two fixtures flickering", location: "Main Lobby", category: "electrical", priority: "normal", status: "in_progress", assignedTo: "HK Supervisor", reportedBy: "Manager" },
    ]);
    console.log("Created demo maintenance requests");
  }

  const existingRoomService = await db.select().from(roomServiceRequestsTable).where(eq(roomServiceRequestsTable.restaurantId, restaurant.id));
  if (existingRoomService.length === 0) {
    await db.insert(roomServiceRequestsTable).values([
      { restaurantId: restaurant.id, roomNumber: "501", guestName: "Rahul Mehta", type: "food", status: "pending", items: [{ name: "Continental breakfast", qty: 2 }], notes: "Deliver by 8 AM", estimatedTime: 25 },
      { restaurantId: restaurant.id, roomNumber: "305", guestName: "Priya Sharma", type: "housekeeping", status: "in_progress", items: [{ name: "Extra towels", qty: 4 }], assignedTo: "HK Supervisor", estimatedTime: 15 },
      { restaurantId: restaurant.id, roomNumber: "PH-1", guestName: "VIP Guest", type: "food", status: "accepted", items: [{ name: "Chef tasting menu", qty: 2 }], assignedTo: "Ahmed Al-Rashidi", estimatedTime: 45 },
    ]);
    console.log("Created demo room service requests");
  }

  const existingCalls = await db.select().from(waiterCallsTable).where(eq(waiterCallsTable.restaurantId, restaurant.id));
  if (existingCalls.length === 0) {
    const barTable = tableByName["T-BAR1"];
    const vipTable = tableByName["T-VIP"];
    await db.insert(waiterCallsTable).values([
      { restaurantId: restaurant.id, tableId: barTable?.id, tableName: "T-BAR1", type: "waiter", message: "Guest needs menu assistance", isResolved: false },
      { restaurantId: restaurant.id, tableId: vipTable?.id, tableName: "T-VIP", type: "bill", message: "VIP table requests bill", isResolved: false },
    ]);
    console.log("Created demo waiter calls");
  }

  const existingRecipes = await db.select().from(recipesTable).where(eq(recipesTable.restaurantId, restaurant.id));
  if (existingRecipes.length === 0 && pizza && biryani) {
    await db.insert(recipesTable).values([
      { restaurantId: restaurant.id, name: pizza.name, category: "Main", servings: 1, preparationTime: 18, sellingPrice: String(parseFloat(pizza.price)), totalCost: "120", profitMargin: "62" },
      { restaurantId: restaurant.id, name: biryani.name, category: "Main", servings: 1, preparationTime: 25, sellingPrice: String(parseFloat(biryani.price)), totalCost: "95", profitMargin: "58" },
    ]);
    console.log("Created demo recipes");
  }

  const existingChat = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.restaurantId, restaurant.id));
  if (existingChat.length === 0) {
    await db.insert(chatMessagesTable).values([
      { restaurantId: restaurant.id, senderId: "system", senderName: "Dispatch Desk", senderRole: "manager", message: "VIP table T-VIP is on course 2 — prioritize mains", messageType: "alert", channel: "kitchen" },
      { restaurantId: restaurant.id, senderId: "waiter-1", senderName: "Ahmed Al-Rashidi", senderRole: "waiter", message: "Need extra napkins for T-FAM", messageType: "text", channel: "waiter" },
    ]);
    console.log("Created demo kitchen communication messages");
  }

  const existingRoomOrders = await db.select().from(ordersTable).where(
    and(eq(ordersTable.restaurantId, restaurant.id), eq(ordersTable.type, "room_service")),
  );
  if (existingRoomOrders.length === 0 && dal) {
    await db.insert(ordersTable).values({
      restaurantId: restaurant.id,
      tableName: "Room 501",
      customerName: "James Smith",
      type: "room_service",
      status: "preparing",
      items: [{ menuItemId: dal.id, name: dal.name, price: parseFloat(dal.price), quantity: 2, subtotal: 200 }],
      subtotal: "200",
      tax: "10",
      total: "210",
      paymentStatus: "pending",
      guestCount: 2,
      metadata: { roomNumber: "501", deliveryType: "room" },
      branchId: branch.id,
    });
    console.log("Created demo room service kitchen order");
  }

  const existingSpaBookings = await db.select().from(spaBookingsTable).where(eq(spaBookingsTable.restaurantId, restaurant.id));
  if (existingSpaBookings.length === 0) {
    const services = await db.select().from(spaServicesTable).where(eq(spaServicesTable.restaurantId, restaurant.id)).limit(3);
    const svc = (i: number) => services[i] ?? services[0];
    if (svc(0)) {
      await db.insert(spaBookingsTable).values([
        { restaurantId: restaurant.id, serviceId: svc(0)!.id, serviceName: svc(0)!.name, guestName: "Rahul Mehta", guestPhone: "9876500001", therapist: "Anita", scheduledAt: new Date(Date.now() + 2 * 3600000), duration: svc(0)!.duration, price: svc(0)!.price, status: "confirmed" },
        { restaurantId: restaurant.id, serviceId: svc(1)?.id ?? svc(0)!.id, serviceName: svc(1)?.name ?? svc(0)!.name, guestName: "Priya Sharma", guestPhone: "9876500002", therapist: "Meera", scheduledAt: new Date(Date.now() + 5 * 3600000), duration: svc(1)?.duration ?? 60, price: svc(1)?.price ?? "2500", status: "booked" },
        { restaurantId: restaurant.id, serviceId: svc(2)?.id ?? svc(0)!.id, serviceName: svc(2)?.name ?? svc(0)!.name, guestName: "Amit Kumar", guestPhone: "9876500003", scheduledAt: new Date(Date.now() - 86400000), duration: 90, price: "3200", status: "completed", paymentStatus: "paid" },
      ]);
      console.log("Created demo spa bookings");
    }
  }

  const existingCommissions = await db.select().from(staffCommissionsTable).where(eq(staffCommissionsTable.restaurantId, restaurant.id));
  if (existingCommissions.length === 0) {
    await db.insert(staffCommissionsTable).values([
      { restaurantId: restaurant.id, staffName: "Ahmed Al-Rashidi", staffRole: "waiter", type: "sales", amount: "420", percentage: "2", description: "Table upsell commission", status: "approved", month: new Date().toISOString().slice(0, 7) },
      { restaurantId: restaurant.id, staffName: "Sara Johnson", staffRole: "cashier", type: "incentive", amount: "300", description: "Zero cash mismatch week", status: "paid", month: new Date().toISOString().slice(0, 7), paidAt: new Date() },
      { restaurantId: restaurant.id, staffName: "Bar Captain", staffRole: "bar", type: "tip", amount: "850", description: "Friday bar tips pool", status: "pending", month: new Date().toISOString().slice(0, 7) },
    ]);
    console.log("Created demo staff commissions");
  }

  const existingDocs = await db.select().from(documentsTable).where(eq(documentsTable.restaurantId, restaurant.id));
  if (existingDocs.length === 0) {
    await db.insert(documentsTable).values([
      { restaurantId: restaurant.id, name: "FSSAI License", category: "License", fileType: "PDF", fileSize: 2400000, expiryDate: new Date("2026-03-01"), status: "active", uploadedBy: "Demo Owner" },
      { restaurantId: restaurant.id, name: "GST Registration Certificate", category: "GST", fileType: "PDF", fileSize: 1800000, status: "active", uploadedBy: "Demo Owner" },
      { restaurantId: restaurant.id, name: "Fire NOC Certificate", category: "Safety", fileType: "PDF", fileSize: 3200000, expiryDate: new Date(Date.now() + 20 * 86400000), status: "pending_renewal", uploadedBy: "Demo Owner" },
    ]);
    console.log("Created demo documents");
  }

  console.log("Seed complete!");
  return { restaurantId: restaurant.id, slug: restaurant.slug };
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("seed");
if (isDirectRun) {
  runSeed()
    .then(() => process.exit(0))
    .catch((e) => { console.error("Seed error:", e); process.exit(1); });
}
