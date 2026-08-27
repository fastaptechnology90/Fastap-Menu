import { useState, useEffect } from "react";
import { ShoppingCart, Truck, Plus, X, CheckCircle, Clock, AlertCircle, Upload, Search, Building2, TrendingUp, Package, FileText, Star, DollarSign, ChevronDown, Filter } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { procurement as procurementApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { PermissionGate } from "@/components/restaurant/PermissionGate";

type PurchaseOrderRow = {
  id: string; supplier: string; items: { name: string; qty: number; unit: string; price: number; total: number }[];
  total: number; status: string; createdAt: string; expectedBy: string; deliveredAt: string | null;
  paymentStatus: string; invoiceNo: string;
};
type SupplierRow = {
  id: string; name: string; category: string; contact: string; phone: string; email: string;
  rating: number; totalOrders: number; totalSpend: number; creditLimit: number; creditUsed: number;
  paymentStatus?: string; paymentTerms: string; status: string;
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  draft:      {label:"Draft",     color:"text-white/40",  bg:"bg-white/10"},
  pending:    {label:"Pending",   color:"text-yellow-400",bg:"bg-yellow-500/15"},
  approved:   {label:"Approved",  color:"text-blue-400",  bg:"bg-blue-500/15"},
  sent:       {label:"Sent",      color:"text-cyan-400",  bg:"bg-cyan-500/15"},
  "in-transit":{label:"In Transit",color:"text-violet-400",bg:"bg-violet-500/15"},
  received:   {label:"Received",  color:"text-emerald-400",bg:"bg-emerald-500/15"},
  delivered:  {label:"Delivered", color:"text-emerald-400",bg:"bg-emerald-500/15"},
  cancelled:  {label:"Cancelled", color:"text-red-400",   bg:"bg-red-500/15"},
};

const DEFAULT_STATUS_CFG = {label:"Unknown",color:"text-white/40",bg:"bg-white/10"};
const statusCfg = (s: string) => STATUS_CFG[s] ?? DEFAULT_STATUS_CFG;

const INV_STATUS_CFG: Record<string,{color:string;bg:string}> = {
  paid:    {color:"text-emerald-400",bg:"bg-emerald-500/15"},
  pending: {color:"text-yellow-400",bg:"bg-yellow-500/15"},
  overdue: {color:"text-red-400",   bg:"bg-red-500/15"},
};
const invStatusCfg = (s: string) => INV_STATUS_CFG[s] ?? {color:"text-white/40",bg:"bg-white/10"};

type Tab = "purchase-orders"|"suppliers"|"invoices";

export default function PurchaseProcurement() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("purchase-orders");
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [poForm, setPoForm] = useState({ supplierName: "", itemName: "", qty: 1, unitPrice: 0 });
  const [creatingPo, setCreatingPo] = useState(false);

  async function createPO() {
    if (!restaurantId || !poForm.supplierName || !poForm.itemName) return;
    setCreatingPo(true);
    try {
      const total = poForm.qty * poForm.unitPrice;
      const created = await procurementApi.createPO(restaurantId, {
        supplierName: poForm.supplierName,
        // Backend computes the PO total from item.quantity * item.unitPrice, so send
        // those field names (keep qty/price too for the optimistic row rendering below).
        items: [{ name: poForm.itemName, quantity: poForm.qty, qty: poForm.qty, unit: "kg", unitPrice: poForm.unitPrice, price: poForm.unitPrice, total }],
        total,
        status: "pending",
      });
      setOrders(prev => [{
        id: created.poNumber || String(created.id),
        supplier: poForm.supplierName,
        items: [{ name: poForm.itemName, qty: poForm.qty, unit: "kg", price: poForm.unitPrice, total }],
        total,
        status: "pending",
        createdAt: new Date().toISOString().split("T")[0],
        expectedBy: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        deliveredAt: null,
        paymentStatus: "pending",
        invoiceNo: "—",
      }, ...prev]);
      setShowAdd(false);
      setPoForm({ supplierName: "", itemName: "", qty: 1, unitPrice: 0 });
    } catch { /* create failed */ }
    finally { setCreatingPo(false); }
  }

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      procurementApi.purchaseOrders(restaurantId).catch(() => []),
      procurementApi.suppliers(restaurantId).catch(() => []),
    ]).then(([poData, supData]) => {
      if (Array.isArray(poData)) {
        setOrders(poData.map((o:any)=>({
          id: o.poNumber || String(o.id),
          supplier: o.supplierName || "Supplier",
          // API stores items as {name, quantity, unitPrice}. Normalize to the shape the
          // UI renders ({name, qty, unit, price, total}) so the detail modal never hits
          // undefined.toLocaleString() and crashes the whole page.
          items: (Array.isArray(o.items) ? o.items : []).map((it: any) => {
            const qty = Number(it.qty ?? it.quantity ?? 0);
            const price = Number(it.price ?? it.unitPrice ?? 0);
            return { name: it.name || "Item", qty, unit: it.unit || "unit", price, total: Number(it.total ?? qty * price) };
          }),
          total: parseFloat(String(o.total||0)),
          status: o.status === "received" ? "delivered" : o.status || "pending",
          createdAt: o.createdAt?.split("T")[0] || "",
          expectedBy: o.expectedDelivery?.split("T")[0] || "",
          deliveredAt: o.deliveredAt?.split("T")[0] || null,
          paymentStatus: o.status === "received" ? "paid" : "pending",
          invoiceNo: o.invoiceUrl || "—",
        })));
      }
      if (Array.isArray(supData)) {
        setSuppliers(supData.map((s:any)=>({
          id: String(s.id),
          name: s.name,
          category: s.category || "General",
          contact: s.contactPerson || "—",
          phone: s.phone || "",
          email: s.email || "",
          rating: (s.rating ?? 5) / 1,
          totalOrders: 0,
          totalSpend: parseFloat(String(s.outstandingBalance ?? 0)) * 10,
          creditLimit: parseFloat(String(s.creditLimit ?? 0)),
          creditUsed: parseFloat(String(s.outstandingBalance ?? 0)),
          paymentTerms: s.paymentTerms || "7 days",
          status: s.isActive !== false ? "active" : "inactive",
        })));
      }
    });
  }, [restaurantId]);

  const invoiceList = orders
    .filter(o => o.status === "delivered")
    .map(o => ({
      id: o.invoiceNo !== "—" ? o.invoiceNo : `INV-${o.id}`,
      po: o.id,
      supplier: o.supplier,
      amount: o.total,
      dueDate: o.expectedBy,
      status: o.paymentStatus === "paid" ? "paid" : "pending",
      paidOn: o.deliveredAt,
      gst: Math.round(o.total * 0.18),
    }));

  const filtered = orders.filter(o =>
    (statusFilter==="all"||o.status===statusFilter) &&
    (!search||o.supplier.toLowerCase().includes(search.toLowerCase())||o.id.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPending = invoiceList.filter(i=>i.status==="pending"||i.status==="overdue").reduce((s,i)=>s+i.amount,0);
  const overdueCount = invoiceList.filter(i=>i.status==="overdue").length;
  const monthlySpend = orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+o.total,0);

  async function updatePO(id:string, status:string) {
    if (!restaurantId) return;
    const apiStatus = status === "delivered" ? "received" : status;
    try {
      const numericId = orders.find(o => o.id === id);
      if (numericId) {
        const raw = await procurementApi.purchaseOrders(restaurantId);
        const match = (raw as any[]).find((r:any) => (r.poNumber || String(r.id)) === id);
        if (match?.id) await procurementApi.updatePO(restaurantId, match.id, { status: apiStatus });
      }
    } catch {}
    setOrders(o=>o.map(x=>x.id===id?{...x,status}:x));
  }

  // Mark an invoice paid. Invoices derive from delivered POs (status = paymentStatus),
  // so update the underlying PO's paymentStatus (optimistic + best-effort persist).
  async function payInvoice(inv: { po: string }) {
    if (!restaurantId) return;
    setOrders(o => o.map(x => x.id === inv.po ? { ...x, paymentStatus: "paid" } : x));
    try {
      const raw = await procurementApi.purchaseOrders(restaurantId);
      const match = (raw as any[]).find((r:any) => (r.poNumber || String(r.id)) === inv.po);
      if (match?.id) await procurementApi.updatePO(restaurantId, match.id, { paymentStatus: "paid" });
    } catch {}
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Purchase & Procurement</h1>
          <p className="text-xs text-white/40">Purchase orders, supplier management and invoices</p>
        </div>
        {tab==="purchase-orders"&&(
          <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
            <Plus className="h-4 w-4"/>New PO
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Monthly Spend",value:`₹${(monthlySpend/1000).toFixed(0)}K`,color:"text-amber-400",bg:"bg-amber-500/10"},
          {label:"Active POs",value:orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Payables Due",value:`₹${(totalPending/1000).toFixed(0)}K`,color:"text-red-400",bg:"bg-red-500/10"},
          {label:"Overdue Invoices",value:overdueCount,color:"text-orange-400",bg:"bg-orange-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["purchase-orders","Purchase Orders"],["suppliers","Suppliers"],["invoices","Invoices"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="purchase-orders"&&(
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
              <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search supplier, PO number..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all","draft","pending","approved","in-transit","delivered"].map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-semibold border capitalize transition-all ${statusFilter===s?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{s==="all"?"All":s}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map(po=>{
              const scfg = statusCfg(po.status);
              return (
                <div key={po.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 hover:border-white/10 cursor-pointer transition-all" onClick={()=>setSelectedPO(po)}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0"><ShoppingCart className="h-5 w-5 text-amber-400"/></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold">{po.id}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${po.paymentStatus==="paid"?"bg-emerald-500/20 text-emerald-400":"bg-yellow-500/20 text-yellow-400"}`}>{po.paymentStatus==="paid"?"Paid":"Payment Pending"}</span>
                      </div>
                      <p className="text-sm text-white/60">{po.supplier}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                        <span>{po.items.length} item{po.items.length!==1?"s":""}</span>
                        <span>Created: {po.createdAt}</span>
                        <span>Expected: {po.expectedBy}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-extrabold text-amber-400">₹{po.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    {po.status==="draft"&&<button onClick={e=>{e.stopPropagation();updatePO(po.id,"pending");}} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30">Submit for Approval</button>}
                    {po.status==="pending"&&<PermissionGate permission="approve_purchase"><button onClick={e=>{e.stopPropagation();updatePO(po.id,"approved");}} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30">Approve</button></PermissionGate>}
                    {po.status==="in-transit"&&<button onClick={e=>{e.stopPropagation();updatePO(po.id,"delivered");}} className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 text-xs font-semibold hover:bg-teal-500/30 flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Mark Delivered</button>}
                  </div>
                </div>
              );
            })}
            {filtered.length===0&&<EmptyState title="No purchase orders" description="Create a PO to track procurement." />}
          </div>
        </>
      )}

      {tab==="suppliers"&&(
        <div className="space-y-3">
          {suppliers.length === 0 ? <EmptyState title="No suppliers" /> : suppliers.map(s=>{
            const creditPct = Math.round((s.creditUsed/s.creditLimit)*100);
            return (
              <div key={s.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/15 flex items-center justify-center shrink-0"><Building2 className="h-6 w-6 text-blue-400"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold">{s.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Active</span>
                    </div>
                    <p className="text-xs text-white/40 mb-3">{s.category} · {s.contact} · {s.phone} · {s.paymentTerms} credit</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        {label:"Total Orders",value:s.totalOrders,color:"text-blue-400"},
                        {label:"Total Spend",value:`₹${(s.totalSpend/1000).toFixed(0)}K`,color:"text-amber-400"},
                        {label:"Rating",value:`${s.rating}★`,color:"text-yellow-400"},
                        {label:"Credit Used",value:`₹${(s.creditUsed/1000).toFixed(0)}K/₹${(s.creditLimit/1000).toFixed(0)}K`,color:creditPct>80?"text-red-400":"text-emerald-400"},
                      ].map(m=>(
                        <div key={m.label} className="bg-white/5 rounded-lg p-2 text-center">
                          <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                          <p className="text-xs text-white/30">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1"><span className="text-white/40">Credit Utilization</span><span className={creditPct>80?"text-red-400":"text-white/40"}>{creditPct}%</span></div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full ${creditPct>80?"bg-red-500":creditPct>60?"bg-yellow-500":"bg-emerald-500"}`} style={{width:`${creditPct}%`}}/>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={()=>{ setPoForm(f=>({...f,supplierName:s.name})); setShowAdd(true); }} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30">New PO</button>
                    <button onClick={()=>{ setSearch(s.name); setTab("purchase-orders"); }} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/50 text-xs font-semibold hover:bg-white/10">History</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="invoices"&&(
        <div className="space-y-3">
          {overdueCount>0&&(
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0"/>
              <p className="text-sm text-red-300">{overdueCount} invoice{overdueCount>1?"s":""} overdue. Please process payment immediately.</p>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5">
                {["Invoice No.","PO Ref","Supplier","Amount","GST","Due Date","Status","Action"].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoiceList.map(inv=>{
                const cfg = invStatusCfg(inv.status);
                return (
                  <tr key={inv.id} className={`hover:bg-white/3 transition-all ${inv.status==="overdue"?"bg-red-500/3":""}`}>
                    <td className="py-3 pr-4 font-mono text-xs text-amber-400">{inv.id}</td>
                    <td className="py-3 pr-4 text-xs text-white/50">{inv.po}</td>
                    <td className="py-3 pr-4 font-semibold">{inv.supplier}</td>
                    <td className="py-3 pr-4 font-bold text-amber-400">₹{inv.amount.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-white/50">₹{inv.gst.toLocaleString()}</td>
                    <td className="py-3 pr-4 text-white/60">{inv.dueDate}</td>
                    <td className="py-3 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${cfg.bg} ${cfg.color}`}>{inv.status}</span></td>
                    <td className="py-3">
                      {inv.status!=="paid"&&<button onClick={()=>payInvoice(inv)} className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30">Pay Now</button>}
                      {inv.status==="paid"&&<button onClick={()=>window.print()} className="px-3 py-1 rounded-lg border border-white/10 text-xs text-white/40 hover:bg-white/5">Receipt</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Detail */}
      {selectedPO&&(
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-end" onClick={()=>setSelectedPO(null)}>
          <div className="w-full max-w-md h-full bg-[#0e1520] border-l border-white/10 overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div><h3 className="font-extrabold">{selectedPO.id}</h3><p className="text-xs text-white/40">{selectedPO.supplier}</p></div>
              <button onClick={()=>setSelectedPO(null)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:"Status",value:statusCfg(selectedPO.status).label},
                  {label:"Payment",value:selectedPO.paymentStatus==="paid"?"Paid":"Pending"},
                  {label:"Created",value:selectedPO.createdAt},
                  {label:"Expected",value:selectedPO.expectedBy},
                  {label:"Invoice",value:selectedPO.invoiceNo},
                  {label:"Total",value:`₹${selectedPO.total.toLocaleString()}`},
                ].map(r=>(
                  <div key={r.label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/40">{r.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{r.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Items Ordered</p>
                <div className="rounded-xl border border-white/8 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-white/30 bg-white/5 border-b border-white/5">{["Item","Qty","Unit Price","Total"].map(h=><th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedPO.items.map((item,i)=>(
                        <tr key={i} className="hover:bg-white/3">
                          <td className="px-3 py-2.5 font-medium">{item.name}</td>
                          <td className="px-3 py-2.5 text-white/60">{item.qty} {item.unit}</td>
                          <td className="px-3 py-2.5 text-white/60">₹{Number(item.price || 0).toLocaleString()}</td>
                          <td className="px-3 py-2.5 font-bold text-amber-400">₹{Number(item.total || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-white/5"><td colSpan={3} className="px-3 py-2.5 font-bold">Total</td><td className="px-3 py-2.5 font-extrabold text-amber-400">₹{selectedPO.total.toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                {selectedPO.status==="draft"&&<button onClick={()=>{updatePO(selectedPO.id,"pending");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-sm hover:bg-blue-500/30">Submit</button>}
                {selectedPO.status==="pending"&&<button onClick={()=>{updatePO(selectedPO.id,"approved");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-sm hover:bg-emerald-500/30">Approve</button>}
                {selectedPO.status==="approved"&&<button onClick={()=>{updatePO(selectedPO.id,"in-transit");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-xl bg-violet-500/20 text-violet-400 font-bold text-sm hover:bg-violet-500/30">Mark Dispatched</button>}
                {selectedPO.status==="in-transit"&&<button onClick={()=>{updatePO(selectedPO.id,"delivered");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-xl bg-teal-500/20 text-teal-400 font-bold text-sm hover:bg-teal-500/30">Mark Delivered</button>}
                <button onClick={()=>window.print()} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5">Print PO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">New Purchase Order</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-white/40" /></button>
            </div>
            <input placeholder="Supplier name" value={poForm.supplierName} onChange={e => setPoForm(p => ({ ...p, supplierName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <input placeholder="Item name" value={poForm.itemName} onChange={e => setPoForm(p => ({ ...p, itemName: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min={1} placeholder="Qty" value={poForm.qty} onChange={e => setPoForm(p => ({ ...p, qty: Number(e.target.value) }))} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
              <input type="number" min={0} placeholder="Unit price ₹" value={poForm.unitPrice} onChange={e => setPoForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            </div>
            <button onClick={createPO} disabled={creatingPo || !poForm.supplierName || !poForm.itemName} className="w-full py-3 rounded-xl bg-amber-500 font-bold text-sm disabled:opacity-40">
              {creatingPo ? "Creating…" : `Create PO — ₹${(poForm.qty * poForm.unitPrice).toLocaleString()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
