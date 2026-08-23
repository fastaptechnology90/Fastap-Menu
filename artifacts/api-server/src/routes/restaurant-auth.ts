import { Router, type IRouter, type Request } from "express";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  restaurantsTable,
  staffTable,
  usersTable,
  branchesTable,
  documentsTable,
  platformPlansTable,
} from "@workspace/db";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";
import { normalizeCurrencyCode, PLATFORM_CURRENCY } from "../lib/currency.js";
import {
  activateRestaurantSubscription,
  buildSubscriptionSummary,
  canSubscribeStaffRole,
  listPublishedPlans,
  readSubscriptionRecord,
} from "../lib/restaurant-subscription.js";
import { ensurePlatformDefaults } from "../lib/platform-admin.js";
import {
  restaurantKycStatus,
  isRestaurantPublished,
  getPublicationStatus,
} from "../lib/restaurant-publication.js";

const router: IRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const failedAttempts = new Map<string, { count: number; lockedUntil?: number }>();
const otpStore = new Map<string, { otp: string; expiresAt: number; staffId: number; restaurantId: number }>();

function attemptKey(identity: string) {
  return identity.toLowerCase();
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "restaurant";
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const [existing] = await db
      .select({ id: restaurantsTable.id })
      .from(restaurantsTable)
      .where(eq(restaurantsTable.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    n += 1;
  }
}

function isRestaurantApproved(restaurant: typeof restaurantsTable.$inferSelect): boolean {
  return isRestaurantPublished(restaurant);
}

async function activeRestaurant(restaurantId: number) {
  const [restaurant] = await db
    .select()
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant || !isRestaurantApproved(restaurant)) return undefined;
  return restaurant;
}

async function staffCandidatesByEmailAll(email: string) {
  const normalized = email.trim().toLowerCase();
  return db
    .select({ staff: staffTable, restaurant: restaurantsTable })
    .from(staffTable)
    .innerJoin(restaurantsTable, eq(staffTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        sql`lower(${staffTable.email}) = ${normalized}`,
        eq(staffTable.isActive, true),
      ),
    );
}

function pendingApprovalMessage(status: string): string {
  if (status === "rejected") {
    return "Registration was rejected. Contact support or resubmit your application.";
  }
  return "Your registration is pending super admin approval. You can sign in after your documents are approved.";
}

async function subscriptionPayload(restaurant: typeof restaurantsTable.$inferSelect) {
  await ensurePlatformDefaults();
  const record = readSubscriptionRecord(restaurant);
  const [planRow] = await db
    .select({ name: platformPlansTable.name })
    .from(platformPlansTable)
    .where(eq(platformPlansTable.id, record.planId))
    .limit(1);
  return buildSubscriptionSummary(restaurant, planRow?.name);
}

async function staffResponse(staffMember: typeof staffTable.$inferSelect, restaurant: typeof restaurantsTable.$inferSelect) {
  const subscription = await subscriptionPayload(restaurant);
  return {
    success: true,
    staff: {
      id: staffMember.id,
      name: staffMember.name,
      role: staffMember.role,
      email: staffMember.email,
      phone: staffMember.phone,
    },
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      logoUrl: restaurant.logoUrl,
      currency: normalizeCurrencyCode(restaurant.currency),
      timezone: restaurant.timezone,
      businessType: restaurant.businessType,
      gstNumber: restaurant.gstNumber,
      fssaiNumber: restaurant.fssaiNumber,
      kycStatus: (restaurant.settings as { kyc?: { status?: string } } | null)?.kyc?.status ?? "approved",
      plan: restaurant.plan,
    },
    subscription,
    requiresSubscription: !subscription.active,
  };
}

async function establishSession(
  req: Request,
  staffMember: typeof staffTable.$inferSelect,
  restaurantId: number,
) {
  const userAgent = req.headers["user-agent"] || "unknown";
  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  req.session.staffSession = {
    staffId: String(staffMember.id),
    staffName: staffMember.name,
    staffRole: staffMember.role,
    restaurantId,
    loginAt: new Date().toISOString(),
    device: userAgent.slice(0, 120),
    ip: String(clientIp),
  };
}

async function staffCandidatesByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({ staff: staffTable, restaurant: restaurantsTable })
    .from(staffTable)
    .innerJoin(restaurantsTable, eq(staffTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        sql`lower(${staffTable.email}) = ${normalized}`,
        eq(staffTable.isActive, true),
        eq(restaurantsTable.isActive, true),
      ),
    );
  return rows;
}

async function staffCandidatesByPhone(phone: string) {
  const normalized = String(phone).replace(/\D/g, "");
  const rows = await db
    .select({ staff: staffTable, restaurant: restaurantsTable })
    .from(staffTable)
    .innerJoin(restaurantsTable, eq(staffTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        eq(staffTable.phone, normalized),
        eq(staffTable.isActive, true),
        eq(restaurantsTable.isActive, true),
      ),
    );
  return rows;
}

async function staffCandidatesByPhoneAll(phone: string) {
  const normalized = String(phone).replace(/\D/g, "");
  return db
    .select({ staff: staffTable, restaurant: restaurantsTable })
    .from(staffTable)
    .innerJoin(restaurantsTable, eq(staffTable.restaurantId, restaurantsTable.id))
    .where(
      and(
        eq(staffTable.phone, normalized),
        eq(staffTable.isActive, true),
      ),
    );
}

function pickStaff(
  rows: { staff: typeof staffTable.$inferSelect; restaurant: typeof restaurantsTable.$inferSelect }[],
  restaurantId?: number,
) {
  if (rows.length === 0) return { error: "not_found" as const };
  if (restaurantId) {
    const match = rows.find(r => r.staff.restaurantId === restaurantId);
    if (!match) return { error: "not_found" as const };
    return { row: match };
  }
  if (rows.length > 1) {
    return {
      error: "ambiguous" as const,
      restaurants: rows.map(r => ({
        id: r.restaurant.id,
        name: r.restaurant.name,
        slug: r.restaurant.slug,
        address: r.restaurant.address,
        businessType: r.restaurant.businessType,
      })),
    };
  }
  return { row: rows[0] };
}

router.get("/restaurant-auth/security", async (req, res): Promise<void> => {
  // The matching PUT below already requires a staff session; this GET did not,
  // and it also took the restaurant id from ?restaurantId=. That let anyone read
  // any venue's login-security setup — which login methods are on, whether 2FA and
  // failed-login protection are enabled — useful reconnaissance before an attack.
  // Read the id from the session only, exactly like the PUT does.
  if (!req.session.staffSession) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rid = req.session.staffSession.restaurantId;
  const settings = rid
    ? await getSettingsSection(rid, "authSecurity", {
        otpLogin: true,
        passwordLogin: true,
        twoFactorEnabled: false,
        sessionTimeoutMinutes: 480,
        deviceTracking: true,
        ipRestriction: false,
        geoRestriction: false,
        loginAlerts: true,
        failedLoginProtection: true,
      })
    : {
        otpLogin: true,
        passwordLogin: true,
        twoFactorEnabled: false,
        sessionTimeoutMinutes: 480,
        deviceTracking: true,
        ipRestriction: false,
        geoRestriction: false,
        loginAlerts: true,
        failedLoginProtection: true,
      };
  res.json(settings);
});

router.put("/restaurant-auth/security", async (req, res): Promise<void> => {
  if (!req.session.staffSession) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const rid = req.session.staffSession.restaurantId;
  const current = await getSettingsSection(rid, "authSecurity", {});
  const merged = { ...current, ...req.body };
  await setSettingsSection(rid, "authSecurity", merged);
  res.json(merged);
});

router.post("/restaurant-auth/otp/send", async (req, res): Promise<void> => {
  const { phone, restaurantId } = req.body;
  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const normalized = String(phone).replace(/\D/g, "");
  if (normalized.length < 10) {
    res.status(400).json({ error: "Enter a valid mobile number" });
    return;
  }

  const rows = await staffCandidatesByPhone(normalized);
  let picked = pickStaff(rows, restaurantId ? parseInt(String(restaurantId), 10) : undefined);
  if (picked.error === "not_found") {
    const pendingRows = await staffCandidatesByPhoneAll(normalized);
    const pendingPick = pickStaff(pendingRows, restaurantId ? parseInt(String(restaurantId), 10) : undefined);
    if (pendingPick.row && !isRestaurantApproved(pendingPick.row.restaurant)) {
      res.status(403).json({
        error: pendingApprovalMessage(restaurantKycStatus(pendingPick.row.restaurant)),
        pendingApproval: restaurantKycStatus(pendingPick.row.restaurant) !== "rejected",
      });
      return;
    }
    res.status(404).json({ error: "No active staff account found for this mobile number" });
    return;
  }
  if (picked.error === "ambiguous") {
    res.status(409).json({
      error: "Multiple restaurants linked to this number. Select your venue.",
      restaurants: picked.restaurants,
    });
    return;
  }

  const { staff: staffMember, restaurant } = picked.row!;
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(normalized, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    staffId: staffMember.id,
    restaurantId: restaurant.id,
  });

  // Integrate SMS provider here; OTP is never returned to the client.
  res.json({ success: true, message: "OTP sent to your registered mobile number" });
});

router.post("/restaurant-auth/login", async (req, res): Promise<void> => {
  const { restaurantId, email, password, phone, otp } = req.body;
  const rid = restaurantId ? parseInt(String(restaurantId), 10) : undefined;

  let staffMember: typeof staffTable.$inferSelect | undefined;
  let restaurant: typeof restaurantsTable.$inferSelect | undefined;
  let identityKey = "";

  if (phone && otp) {
    const normalized = String(phone).replace(/\D/g, "");
    identityKey = `phone:${normalized}`;
    const key = attemptKey(identityKey);
    const attempts = failedAttempts.get(key);
    if (attempts?.lockedUntil && attempts.lockedUntil > Date.now()) {
      res.status(429).json({ error: "Too many failed attempts. Try again later.", lockedUntil: attempts.lockedUntil });
      return;
    }

    const stored = otpStore.get(normalized);
    if (!stored || stored.otp !== String(otp) || stored.expiresAt < Date.now()) {
      const cur = failedAttempts.get(key) ?? { count: 0 };
      cur.count += 1;
      if (cur.count >= MAX_FAILED_ATTEMPTS) cur.lockedUntil = Date.now() + LOCKOUT_MS;
      failedAttempts.set(key, cur);
      res.status(401).json({
        error: "Invalid or expired OTP",
        attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - cur.count),
      });
      return;
    }

    if (rid && stored.restaurantId !== rid) {
      res.status(401).json({ error: "Invalid OTP for selected restaurant" });
      return;
    }

    const [row] = await db.select().from(staffTable).where(eq(staffTable.id, stored.staffId)).limit(1);
    staffMember = row;
    restaurant = await activeRestaurant(stored.restaurantId);
    otpStore.delete(normalized);
    failedAttempts.delete(key);

    if (!staffMember?.isActive || !restaurant) {
      res.status(401).json({ error: "Staff account not found or inactive" });
      return;
    }
  } else if (email && password) {
    const normalizedEmail = String(email).trim().toLowerCase();
    identityKey = `email:${normalizedEmail}`;
    const key = attemptKey(identityKey);
    const attempts = failedAttempts.get(key);
    if (attempts?.lockedUntil && attempts.lockedUntil > Date.now()) {
      res.status(429).json({ error: "Too many failed attempts. Try again later.", lockedUntil: attempts.lockedUntil });
      return;
    }

    const rows = await staffCandidatesByEmail(normalizedEmail);
    let picked = pickStaff(rows, rid);
    if (picked.error === "not_found") {
      const pendingRows = await staffCandidatesByEmailAll(normalizedEmail);
      const pendingPick = pickStaff(pendingRows, rid);
      if (pendingPick.row) {
        const pendingStaff = pendingPick.row.staff;
        if (pendingStaff.pinHash && await bcrypt.compare(String(password), pendingStaff.pinHash)) {
          const kyc = restaurantKycStatus(pendingPick.row.restaurant);
          res.status(403).json({
            error: pendingApprovalMessage(kyc),
            pendingApproval: kyc !== "rejected",
            rejected: kyc === "rejected",
          });
          return;
        }
      }
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    if (picked.error === "ambiguous") {
      res.status(409).json({
        error: "This email is linked to multiple restaurants. Select your venue.",
        restaurants: picked.restaurants,
      });
    return;
  }

    staffMember = picked.row!.staff;
    restaurant = picked.row!.restaurant;

    if (!isRestaurantApproved(restaurant)) {
      res.status(403).json({
        error: pendingApprovalMessage(restaurantKycStatus(restaurant)),
        pendingApproval: restaurantKycStatus(restaurant) !== "rejected",
        rejected: restaurantKycStatus(restaurant) === "rejected",
      });
      return;
    }

    if (!staffMember.pinHash) {
      res.status(401).json({ error: "Password not set. Ask your administrator to set a login password." });
      return;
    }

    const valid = await bcrypt.compare(String(password), staffMember.pinHash);
    if (!valid) {
      const cur = failedAttempts.get(key) ?? { count: 0 };
      cur.count += 1;
      if (cur.count >= MAX_FAILED_ATTEMPTS) cur.lockedUntil = Date.now() + LOCKOUT_MS;
      failedAttempts.set(key, cur);
      res.status(401).json({
        error: "Invalid email or password",
        attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - cur.count),
      });
      return;
    }
    failedAttempts.delete(key);
  } else {
    res.status(400).json({ error: "Provide email and password, or phone and OTP" });
    return;
  }

  await establishSession(req, staffMember!, restaurant!.id);
  res.json(await staffResponse(staffMember!, restaurant!));
});

const STAFF_ROLES = new Set([
  "owner", "manager", "cashier", "waiter", "chef", "kitchen", "reception",
  "finance", "housekeeping", "bar", "spa", "hr", "franchise",
]);
const VENUE_CREATOR_ROLES = new Set(["owner", "franchise"]);

// ALL KYC documents are OPTIONAL at registration. Whatever the owner uploads is verified
// by the Fastap team; if nothing is uploaded, the super admin approves the venue manually.
const REQUIRED_BUSINESS_DOC_TYPES: readonly string[] = [];

const DOC_TYPE_LABELS: Record<string, string> = {
  gst_certificate: "GST registration certificate",
  fssai_license: "FSSAI license copy",
  business_registration: "Business registration / Shop Act license",
  bank_proof: "Bank proof (cancelled cheque or statement)",
};

function hasUploadedDoc(docs: unknown[], type: string): boolean {
  if (!Array.isArray(docs)) return false;
  return docs.some(d => {
    const doc = d as { type?: string; fileUrl?: string };
    return doc?.type === type && typeof doc.fileUrl === "string" && doc.fileUrl.trim().length > 0;
  });
}

function validateRegistrationDocuments(docs: unknown[]): string | null {
  for (const type of REQUIRED_BUSINESS_DOC_TYPES) {
    if (!hasUploadedDoc(docs, type)) {
      return `Missing required document: ${DOC_TYPE_LABELS[type] ?? type}`;
    }
  }
  return null;
}

router.post("/restaurant-auth/register/staff", async (req, res): Promise<void> => {
  // Self-service staff signup is closed.
  //
  // This route looked a venue up by its `slug` — the value printed inside every
  // table QR code — then created an ACTIVE staff row and opened a session straight
  // away. Anyone who scanned a menu could make themselves that restaurant's manager
  // (or finance/HR) and read its KYC documents, GST number, accounts and staff list.
  //
  // Nothing calls this route: no screen in fastap-admin, and none of the three
  // Flutter apps. The registration page itself already tells staff the correct
  // path — "Staff members should ask their manager for access" — and the mobile
  // endpoint /v1/auth/register answers the same way. This now matches both.
  //
  // Owners still add staff from the restaurant panel; that flow is untouched.
  res.status(403).json({
    success: false,
    message: "Ask your restaurant manager to create your staff account in the admin panel.",
    code: "STAFF_SELF_SIGNUP_DISABLED",
  });
  return;

  /* eslint-disable no-unreachable */
  const { name, email, password, phone, role, restaurantSlug } = req.body;

  if (!name?.trim() || !email?.trim() || !password || String(password).length < 6) {
    res.status(400).json({ error: "Name, email, and password (6+ chars) are required" });
    return;
  }
  if (!phone || String(phone).replace(/\D/g, "").length < 10) {
    res.status(400).json({ error: "Mobile number is required" });
    return;
  }
  const staffRole = String(role || "").toLowerCase();
  if (!STAFF_ROLES.has(staffRole) || VENUE_CREATOR_ROLES.has(staffRole)) {
    res.status(400).json({ error: "Select a valid staff role (manager, waiter, cashier, etc.)" });
    return;
  }
  const slug = String(restaurantSlug || "").trim().toLowerCase();
  if (!slug) {
    res.status(400).json({ error: "Restaurant venue code is required" });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const [existingStaff] = await db
    .select()
    .from(staffTable)
    .where(sql`lower(${staffTable.email}) = ${normalizedEmail}`)
    .limit(1);
  if (existingStaff) {
    res.status(409).json({ error: "This email is already registered as staff" });
    return;
  }

  const [venueRow] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.slug, slug)).limit(1);
  const restaurant = venueRow ? await activeRestaurant(venueRow.id) : undefined;
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found. Check your venue code (e.g. spice-garden)" });
    return;
  }

  const pinHash = await bcrypt.hash(String(password), 10);
  const phoneNorm = String(phone).replace(/\D/g, "");

  const [staffMember] = await db.insert(staffTable).values({
    restaurantId: restaurant.id,
    name: name.trim(),
    email: normalizedEmail,
    phone: phoneNorm,
    role: staffRole,
    pinHash,
    isActive: true,
    joinDate: new Date(),
  }).returning();

  await establishSession(req, staffMember, restaurant.id);
  res.status(201).json(await staffResponse(staffMember, restaurant));
  /* eslint-enable no-unreachable */
});

router.post("/restaurant-auth/register", async (req, res): Promise<void> => {
  const {
    staffRole: rawStaffRole,
    ownerName,
    ownerEmail,
    ownerPassword,
    ownerPhone,
    ownerIdType,
    ownerIdNumber,
    restaurantName,
    businessType,
    address,
    city,
    state,
    pincode,
    restaurantPhone,
    restaurantEmail,
    website,
    legalBusinessName,
    gstNumber,
    fssaiNumber,
    panNumber,
    bankAccount,
    ifsc,
    documents = [],
  } = req.body;

  const staffRole = String(rawStaffRole || "owner").toLowerCase();
  if (!VENUE_CREATOR_ROLES.has(staffRole)) {
    res.status(400).json({ error: "Use staff registration for this role, or select Owner / Franchise" });
    return;
  }

  if (!ownerName?.trim() || !ownerEmail?.trim() || !ownerPassword || String(ownerPassword).length < 6) {
    res.status(400).json({ error: "Owner name, email, and password (6+ chars) are required" });
    return;
  }
  if (!ownerPhone || String(ownerPhone).replace(/\D/g, "").length < 10) {
    res.status(400).json({ error: "Owner mobile number is required" });
    return;
  }
  if (!restaurantName?.trim() || !address?.trim()) {
    res.status(400).json({ error: "Restaurant name and address are required" });
    return;
  }
  // Bank account + IFSC are REQUIRED (needed for payouts). GST/FSSAI/PAN numbers and all
  // document uploads stay OPTIONAL — the super admin verifies/approves those after signup.
  if (!bankAccount?.trim() || !ifsc?.trim()) {
    res.status(400).json({ error: "Bank account and IFSC are required" });
    return;
  }
  const docError = validateRegistrationDocuments(documents);
  if (docError) {
    res.status(400).json({ error: docError });
    return;
  }

  const email = String(ownerEmail).trim().toLowerCase();

  try {
    const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existingUser) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const [existingStaff] = await db
      .select()
      .from(staffTable)
      .where(sql`lower(${staffTable.email}) = ${email}`)
      .limit(1);
    if (existingStaff) {
      res.status(409).json({ error: "This email is already registered as staff" });
      return;
    }

    const passwordHash = await bcrypt.hash(String(ownerPassword), 12);
    const pinHash = await bcrypt.hash(String(ownerPassword), 10);
    const slug = await uniqueSlug(restaurantName);
    const ownerPhoneNorm = String(ownerPhone).replace(/\D/g, "");

    const kycPayload = {
      status: "pending",
      legalBusinessName: legalBusinessName || restaurantName,
      ownerIdType: ownerIdType || null,
      ownerIdNumber: ownerIdNumber?.trim() || null,
      gstNumber: gstNumber || null,
      fssaiNumber: fssaiNumber || null,
      panNumber: panNumber || null,
      bankAccount: bankAccount || null,
      ifsc: ifsc || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      submittedAt: new Date().toISOString(),
    };

    const result = await db.transaction(async (tx) => {
      const [owner] = await tx
        .insert(usersTable)
        .values({
          name: ownerName.trim(),
          email,
          passwordHash,
          role: "restaurant_owner",
          isEmailVerified: false,
        })
        .returning();

      const [restaurant] = await tx
        .insert(restaurantsTable)
        .values({
          userId: owner.id,
          name: restaurantName.trim(),
          slug,
          description: `${restaurantName.trim()} — powered by FastMenu`,
          address: [address, city, state, pincode].filter(Boolean).join(", "),
          phone: restaurantPhone || ownerPhoneNorm || null,
          email: restaurantEmail || email,
          website: website || null,
          currency: PLATFORM_CURRENCY,
          businessType: businessType || "restaurant",
          timezone: "Asia/Kolkata",
          isActive: false,
          plan: "free",
          gstNumber: gstNumber || null,
          fssaiNumber: fssaiNumber || null,
          settings: { kyc: kycPayload },
        })
        .returning();

      await tx.insert(branchesTable).values({
        restaurantId: restaurant.id,
        name: "Main Branch",
        address: [address, city, state, pincode].filter(Boolean).join(", "),
        phone: restaurantPhone || ownerPhoneNorm || null,
        isActive: true,
      });

      const [ownerStaff] = await tx
        .insert(staffTable)
        .values({
          restaurantId: restaurant.id,
          name: ownerName.trim(),
          email,
          phone: ownerPhoneNorm,
          role: staffRole,
          pinHash,
          isActive: true,
          joinDate: new Date(),
        })
        .returning();

      if (Array.isArray(documents) && documents.length > 0) {
        for (const doc of documents) {
          if (!doc?.name || !doc?.fileUrl?.trim()) continue;
          const fileUrl = doc.fileUrl.trim();
          await tx.insert(documentsTable).values({
            restaurantId: restaurant.id,
            name: doc.name,
            category: "compliance",
            description: doc.type || "kyc",
            fileUrl,
            fileType: doc.fileType || null,
            fileSize: fileUrl.length,
            uploadedBy: ownerName.trim(),
            status: "pending_renewal",
          });
        }
      }

      return { restaurant };
    });

    res.status(201).json({
      success: true,
      pendingApproval: true,
      message: "Registration submitted successfully. Your account will be activated after super admin approves your documents.",
      restaurant: {
        id: result.restaurant.id,
        name: result.restaurant.name,
        slug: result.restaurant.slug,
        kycStatus: "pending",
      },
    });
  } catch (e) {
    const parts: string[] = [];
    if (e instanceof Error) {
      parts.push(e.message);
      if (e.cause instanceof Error) parts.push(e.cause.message);
    }
    const msg = parts.join(" ") || "Registration failed";
    const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "23505") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    console.error("[restaurant-auth/register]", e);
    const dbUnavailable = /password authentication failed|ECONNREFUSED|does not exist|connection terminated/i.test(msg);
    res.status(dbUnavailable ? 503 : 500).json({
      error: dbUnavailable
        ? "Registration service is temporarily unavailable. Please try again shortly."
        : "Registration failed. Please try again.",
    });
  }
});

router.get("/restaurant-auth/subscription/plans", async (req, res): Promise<void> => {
  if (!req.session.staffSession) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const plans = await listPublishedPlans();
  res.json({
    plans: plans.filter(p => p.id !== "free"),
    currency: PLATFORM_CURRENCY,
  });
});

router.get("/restaurant-auth/subscription", async (req, res): Promise<void> => {
  if (!req.session.staffSession) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const restaurantId = req.session.staffSession.restaurantId;
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) {
    res.status(404).json({ error: "Restaurant not found" });
    return;
  }
  const subscription = await subscriptionPayload(restaurant);
  res.json({
    subscription,
    requiresSubscription: !subscription.active,
    canSubscribe: canSubscribeStaffRole(req.session.staffSession.staffRole),
  });
});

router.post("/restaurant-auth/subscription/subscribe", async (req, res): Promise<void> => {
  if (!req.session.staffSession) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!canSubscribeStaffRole(req.session.staffSession.staffRole)) {
    res.status(403).json({ error: "Only owner, manager, franchise, or finance roles can purchase a subscription." });
    return;
  }

  const { planId } = req.body as { planId?: string };
  if (!planId?.trim()) {
    res.status(400).json({ error: "planId is required" });
    return;
  }

  const restaurantId = req.session.staffSession.restaurantId;
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant || !isRestaurantApproved(restaurant)) {
    res.status(403).json({ error: "Restaurant must be approved before subscribing." });
    return;
  }

  try {
    const subscription = await activateRestaurantSubscription(restaurantId, planId.trim());
    res.json({ success: true, subscription, requiresSubscription: !subscription.active });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Subscription failed" });
  }
});

router.get("/restaurant-auth/me", async (req, res): Promise<void> => {
  if (!req.session.staffSession) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const { restaurantId, staffId, staffName, staffRole } = req.session.staffSession;
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant || !isRestaurantApproved(restaurant)) {
    req.session.staffSession = undefined;
    res.status(403).json({
      error: restaurant ? pendingApprovalMessage(restaurantKycStatus(restaurant)) : "Restaurant not found",
      pendingApproval: restaurant ? restaurantKycStatus(restaurant) !== "rejected" : false,
    });
    return;
  }
  const subscription = await subscriptionPayload(restaurant);
  res.json({
    staff: { id: staffId, name: staffName, role: staffRole },
    restaurant: restaurant
      ? {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          address: restaurant.address,
          phone: restaurant.phone,
          email: restaurant.email,
          logoUrl: restaurant.logoUrl,
          currency: normalizeCurrencyCode(restaurant.currency),
          businessType: restaurant.businessType,
          gstNumber: restaurant.gstNumber,
          fssaiNumber: restaurant.fssaiNumber,
          kycStatus: restaurantKycStatus(restaurant),
          isPublished: isRestaurantPublished(restaurant),
          publicationStatus: getPublicationStatus(restaurant),
          plan: restaurant.plan,
        }
      : null,
    restaurantId,
    subscription,
    requiresSubscription: !subscription.active,
    canSubscribe: canSubscribeStaffRole(staffRole),
  });
});

router.post("/restaurant-auth/logout", async (req, res): Promise<void> => {
  req.session.staffSession = undefined;
  res.json({ success: true });
});

export default router;
