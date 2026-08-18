import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const accounts: Record<number, any[]> = {};
const invoices: Record<number, any[]> = {};
const wallets: Record<number, any[]> = {};
let nextId = 100;

function getAccounts(rid: number) {
  if (!accounts[rid]) {
    accounts[rid] = [
      { id: 1, company: "TechCorp India", gst: "29ABCDE1234F1Z5", contact: "HR Manager", email: "hr@techcorp.in", phone: "9876543210", credit_limit: 50000, outstanding: 12500, status: "active", employees: 45, monthly_avg: 8000, joined: "2025-01-15" },
      { id: 2, company: "Infosys Canteen", gst: "29FGHIJ5678G2Y6", contact: "Admin", email: "admin@infosys.in", phone: "9123456789", credit_limit: 200000, outstanding: 35000, status: "active", employees: 200, monthly_avg: 45000, joined: "2024-11-01" },
      { id: 3, company: "StartupHub Pvt", gst: "", contact: "CEO", email: "ceo@startuphub.in", phone: "8765432109", credit_limit: 10000, outstanding: 0, status: "inactive", employees: 8, monthly_avg: 2000, joined: "2025-03-01" },
    ];
  }
  return accounts[rid];
}

function getInvoices(rid: number) {
  if (!invoices[rid]) {
    invoices[rid] = [
      { id: 1, invoice_no: "CI-2025-001", company_id: 1, company: "TechCorp India", amount: 12500, gst: 2250, total: 14750, period: "May 2025", status: "pending", due_date: "2025-06-15", items: 45 },
      { id: 2, invoice_no: "CI-2025-002", company_id: 2, company: "Infosys Canteen", amount: 35000, gst: 6300, total: 41300, period: "May 2025", status: "paid", due_date: "2025-06-10", items: 180, paid_date: "2025-06-08" },
      { id: 3, invoice_no: "CI-2025-003", company_id: 1, company: "TechCorp India", amount: 8200, gst: 1476, total: 9676, period: "April 2025", status: "paid", due_date: "2025-05-15", items: 32, paid_date: "2025-05-12" },
    ];
  }
  return invoices[rid];
}

function getWallets(rid: number) {
  if (!wallets[rid]) {
    wallets[rid] = [
      { id: 1, company_id: 1, company: "TechCorp India", employee: "Raj Kumar", employee_id: "EMP001", balance: 3000, monthly_limit: 3000, used: 1250, transactions: [] },
      { id: 2, company_id: 1, company: "TechCorp India", employee: "Priya Sharma", employee_id: "EMP002", balance: 3000, monthly_limit: 3000, used: 2100, transactions: [] },
      { id: 3, company_id: 2, company: "Infosys Canteen", employee: "Amit Patel", employee_id: "INF001", balance: 5000, monthly_limit: 5000, used: 800, transactions: [] },
    ];
  }
  return wallets[rid];
}

router.get("/restaurants/:restaurantId/corporate/accounts", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  res.json(getAccounts(rid));
});

router.post("/restaurants/:restaurantId/corporate/accounts", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const account = { id: ++nextId, outstanding: 0, status: "active", joined: new Date().toISOString().split("T")[0], ...req.body };
  getAccounts(rid).push(account);
  res.status(201).json(account);
});

router.put("/restaurants/:restaurantId/corporate/accounts/:id", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);
  const accts = getAccounts(rid);
  const idx = accts.findIndex(a => a.id === id);
  if (idx === -1) { res.status(404).json({ error: "Account not found" }); return; }
  accts[idx] = { ...accts[idx], ...req.body };
  res.json(accts[idx]);
});

router.get("/restaurants/:restaurantId/corporate/invoices", requireAuth, (req, res) => {
  res.json(getInvoices(parseInt(req.params.restaurantId, 10)));
});

router.post("/restaurants/:restaurantId/corporate/invoices", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const count = getInvoices(rid).length + 1;
  const inv = { id: ++nextId, invoice_no: `CI-2026-${String(count).padStart(3, "0")}`, status: "pending", ...req.body, created_at: new Date().toISOString() };
  getInvoices(rid).unshift(inv);
  res.status(201).json(inv);
});

router.put("/restaurants/:restaurantId/corporate/invoices/:id", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);
  const invs = getInvoices(rid);
  const idx = invs.findIndex(i => i.id === id);
  if (idx === -1) { res.status(404).json({ error: "Invoice not found" }); return; }
  invs[idx] = { ...invs[idx], ...req.body };
  res.json(invs[idx]);
});

router.get("/restaurants/:restaurantId/corporate/wallets", requireAuth, (req, res) => {
  res.json(getWallets(parseInt(req.params.restaurantId, 10)));
});

router.post("/restaurants/:restaurantId/corporate/wallets", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const wallet = { id: ++nextId, used: 0, transactions: [], ...req.body };
  getWallets(rid).push(wallet);
  res.status(201).json(wallet);
});

export default router;
