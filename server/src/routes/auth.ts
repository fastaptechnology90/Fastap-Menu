import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "../db/index.js";
import { RegisterBody, LoginBody } from "../schemas.js";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, email, password } = parsed.data;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) { res.status(400).json({ error: "Email already registered" }); return; }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role: "restaurant_owner" }).returning();
  req.session.userId = user.id;
  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt }, message: "Registration successful" });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) { res.status(401).json({ error: "Invalid email or password" }); return; }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Invalid email or password" }); return; }
  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt }, message: "Login successful" });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {});
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
});

export default router;
