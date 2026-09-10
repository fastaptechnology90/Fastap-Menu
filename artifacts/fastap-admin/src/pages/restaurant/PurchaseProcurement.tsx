import { useState, useEffect } from "react";
import { ShoppingCart, Truck, Plus, X, CheckCircle, Clock, AlertCircle, Upload, Search, Building2, TrendingUp, Package, FileText, Star, DollarSign, ChevronDown, Filter, Eye, Receipt } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { procurement as procurementApi } from "@/lib/api";
import { fmtINR } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { PermissionGate } from "@/components/restaurant/PermissionGate";

type PurchaseOrderRow = {
  id: string; supplier: string; items: { name: string; qty: number; unit: string; price: number; total: number }[];
  subtotal: number; tax: number; taxPercent: number;
  total: number; status: string; createdAt: string; expectedBy: string; deliveredAt: string | null;
  paymentStatus: string; invoiceNo: string;
};
type SupplierRow = {
  id: string; name: string; category: string; contact: string; phone: string; email: string;
  rating: number | null; totalOrders: number; totalSpend: number; creditLimit: number; creditUsed: number;
  lastOrderAt: string | null;
  paymentStatus?: string; paymentTerms: string; status: string;
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  draft:      {label:"Draft",     color:"text-muted-foreground",  bg:"bg-muted"},
  pending:    {label:"Pending",   color:"text-warning",bg:"bg-warning-subtle"},
  approved:   {label:"Approved",  color:"text-info",  bg:"bg-info-subtle"},
  sent:       {label:"Sent",      color:"text-info",  bg:"bg-info-subtle"},
  "in-transit":{label:"In Transit",color:"text-muted-foreground",bg:"bg-muted"},
  received:   {label:"Received",  color:"text-success",bg:"bg-success-subtle"},
  delivered:  {label:"Delivered", color:"text-success",bg:"bg-success-subtle"},
  cancelled:  {label:"Cancelled", color:"text-danger",   bg:"bg-danger-subtle"},
};

const DEFAULT_STATUS_CFG = {label:"Unknown",color:"text-muted-foreground",bg:"bg-muted"};
const statusCfg = (s: string) => STATUS_CFG[s] ?? DEFAULT_STATUS_CFG;

const INV_STATUS_CFG: Record<string,{color:string;bg:string}> = {
  paid:    {color:"text-success",bg:"bg-success-subtle"},
  pending: {color:"text-warning",bg:"bg-warning-subtle"},
  overdue: {color:"text-danger",   bg:"bg-danger-subtle"},
};
const invStatusCfg = (s: string) => INV_STATUS_CFG[s] ?? {color:"text-muted-foreground",bg:"bg-muted"};

type Tab = "purchase-orders"|"suppliers"|"invoices";

export default function PurchaseProcurement() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("purchase-orders");
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<SupplierRow | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<{ id: string; po: string; supplier: string; amount: number; dueDate: string; status: string; paidOn: string | null; gst: number; gstPercent: number; grandTotal: number } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [poForm, setPoForm] = useState({ supplierName: "", itemName: "", qty: 1, unitPrice: 0 });
  const [creatingPo, setCreatingPo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        // The server taxes the order at the venue's own rate, so take its figures back
        // rather than showing the untaxed line total as if it were the amount payable.
        subtotal: parseFloat(String(created.subtotal ?? total)),
        tax: parseFloat(String(created.taxAmount ?? created.tax ?? 0)),
        taxPercent: Number(created.taxPercent ?? 0),
        total: parseFloat(String(created.total ?? total)),
        status: "pending",
        createdAt: new Date().toISOString().split("T")[0],
        expectedBy: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        deliveredAt: null,
        paymentStatus: "pending",
        invoiceNo: "—",
      }, ...prev]);
      setShowAdd(false);
      setPoForm({ supplierName: "", itemName: "", qty: 1, unitPrice: 0 });
      toast({ title: "Purchase order created" });
    } catch (e: any) {
      // Keep the form open with what was typed rather than closing on a failure.
      toast({ title: "Purchase order not created", description: e?.message, variant: "destructive" });
    }
    finally { setCreatingPo(false); }
  }

  useEffect(() => {
    if (!restaurantId) return;
    setLoadError(null);
    Promise.all([
      procurementApi.purchaseOrders(restaurantId),
      procurementApi.suppliers(restaurantId),
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
            // The API writes a line as {rate, amount}; reading only price/unitPrice made
            // every purchase-order line render as ₹0.
            const price = Number(it.price ?? it.unitPrice ?? it.rate ?? 0);
            return { name: it.name || "Item", qty, unit: it.unit || "unit", price, total: Number(it.total ?? it.amount ?? qty * price) };
          }),
          subtotal: parseFloat(String(o.subtotal ?? 0)),
          // The order carries its own tax and the rate it was raised at. Recomputing it
          // here at a flat 18% overstated the GST on every purchase order.
          tax: parseFloat(String(o.taxAmount ?? o.tax ?? 0)),
          taxPercent: Number(o.taxPercent ?? 0),
          total: parseFloat(String(o.total||0)),
          status: o.status === "received" ? "delivered" : o.status || "pending",
          createdAt: o.createdAt?.split("T")[0] || "",
          expectedBy: o.expectedDelivery?.split("T")[0] || "",
          deliveredAt: o.deliveredAt?.split("T")[0] || null,
          // There is no supplier-payment column — "received" is not "paid".
          paymentStatus: o.paymentStatus === "paid" ? "paid" : "pending",
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
          // An unrated supplier used to show five stars, and spend was invented from the
          // outstanding balance. Both now come from the server, or say nothing.
          rating: s.rating == null ? null : Number(s.rating),
          totalOrders: Number(s.totalOrders ?? 0),
          totalSpend: parseFloat(String(s.totalSpend ?? 0)),
          lastOrderAt: s.lastOrderAt ? String(s.lastOrderAt).split("T")[0] : null,
          creditLimit: parseFloat(String(s.creditLimit ?? 0)),
          creditUsed: parseFloat(String(s.outstandingBalance ?? 0)),
          paymentTerms: s.paymentTerms || "7 days",
          status: s.isActive !== false ? "active" : "inactive",
        })));
      }
    }).catch(e => {
      // Failure used to render as an empty PO/supplier list with no explanation.
      const msg = e?.message || "Could not load purchase orders or suppliers.";
      setLoadError(msg);
      toast({ title: "Could not load procurement data", description: msg, variant: "destructive" });
    });
  }, [restaurantId]);

  const invoiceList = orders
    .filter(o => o.status === "delivered")
    .map(o => ({
      id: o.invoiceNo !== "—" ? o.invoiceNo : `INV-${o.id}`,
      po: o.id,
      supplier: o.supplier,
      amount: o.subtotal || Math.max(0, o.total - o.tax),
      dueDate: o.expectedBy,
      status: o.paymentStatus === "paid" ? "paid" : "pending",
      paidOn: o.deliveredAt,
      gst: o.tax,
      gstPercent: o.taxPercent,
      grandTotal: o.total,
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
    // The row used to move to its new status whether or not the server accepted it, and
    // the failure was swallowed — so an order could read "Approved" to everyone while the
    // supplier's copy was still awaiting approval. Only advance it once the write lands.
    try {
      const raw = await procurementApi.purchaseOrders(restaurantId);
      const match = (raw as any[]).find((r: any) => (r.poNumber || String(r.id)) === id);
      if (!match?.id) throw new Error("This purchase order is no longer on the server.");
      await procurementApi.updatePO(restaurantId, match.id, { status: apiStatus });
      setOrders(o => o.map(x => x.id === id ? { ...x, status } : x));
      toast({ title: `${id} marked ${status}` });
    } catch (e: any) {
      toast({ title: `Could not update ${id}`, description: e?.message, variant: "destructive" });
    }
  }

  /**
   * Settling a supplier invoice has nowhere to be recorded: purchase_orders carries no
   * payment column and the update endpoint accepts only status and notes. This used to
   * flip the row to "paid" locally and swallow the rejection, so the list showed invoices
   * as settled that no one had paid. Say so instead of inventing a payment.
   */
  function payInvoice(_inv: { po: string }) {
    toast({
      title: "Supplier payments are not recorded yet",
      description: "Mark the order delivered to close it off; settle the invoice in your accounts until payment tracking is added.",
      variant: "destructive",
    });
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Purchase & Procurement</h1>
          <p className="text-xs text-muted-foreground">Purchase orders, supplier management and invoices</p>
        </div>
        {tab==="purchase-orders"&&(
          <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors">
            <Plus className="h-4 w-4"/>New PO
          </button>
        )}
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-danger bg-danger-subtle border border-danger-border rounded-lg px-3 py-2">{loadError}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Monthly Spend",value:`₹${(monthlySpend/1000).toFixed(0)}K`,color:"text-primary",bg:"bg-primary/10"},
          {label:"Active POs",value:orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length,color:"text-info",bg:"bg-info-subtle"},
          {label:"Payables Due",value:`₹${(totalPending/1000).toFixed(0)}K`,color:"text-danger",bg:"bg-danger-subtle"},
          {label:"Overdue Invoices",value:overdueCount,color:"text-warning",bg:"bg-warning-subtle"},
        ].map(s=>(
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["purchase-orders","Purchase Orders"],["suppliers","Suppliers"],["invoices","Invoices"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab==="purchase-orders"&&(
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <input className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search supplier, PO number..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="flex gap-1 flex-wrap">
              {["all","draft","pending","approved","in-transit","delivered"].map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${statusFilter===s?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{s==="all"?"All":s}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map(po=>{
              const scfg = statusCfg(po.status);
              return (
                <div key={po.id} className="bg-card border border-border rounded-lg p-4 hover:border-border cursor-pointer transition-colors" onClick={()=>setSelectedPO(po)}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0"><ShoppingCart className="h-5 w-5 text-primary"/></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold">{po.id}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${po.paymentStatus==="paid"?"bg-success-subtle text-success":"bg-warning-subtle text-warning"}`}>{po.paymentStatus==="paid"?"Paid":"Payment Pending"}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{po.supplier}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{po.items.length} item{po.items.length!==1?"s":""}</span>
                        <span>Created: {po.createdAt}</span>
                        <span>Expected: {po.expectedBy}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold text-primary">₹{po.total.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    {po.status==="draft"&&<button onClick={e=>{e.stopPropagation();updatePO(po.id,"pending");}} className="px-3 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate">Submit for Approval</button>}
                    {po.status==="pending"&&<PermissionGate permission="approve_purchase"><button onClick={e=>{e.stopPropagation();updatePO(po.id,"approved");}} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate">Approve</button></PermissionGate>}
                    {po.status==="in-transit"&&<button onClick={e=>{e.stopPropagation();updatePO(po.id,"delivered");}} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Mark Delivered</button>}
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
              <div key={s.id} onClick={()=>setDetailSupplier(s)} title="Click for full supplier details" className="bg-card border border-border rounded-lg p-5 cursor-pointer hover:border-info-border transition-colors">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-info-subtle flex items-center justify-center shrink-0"><Building2 className="h-6 w-6 text-info"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{s.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success-subtle text-success">Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{s.category} · {s.contact} · {s.phone} · {s.paymentTerms} credit</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        {label:"Total Orders",value:s.totalOrders,color:"text-info"},
                        {label:"Total Spend",value:fmtINR(s.totalSpend),color:"text-primary"},
                        {label:"Rating",value:s.rating == null ? "Not rated" : String(s.rating),color:"text-warning"},
                        {label:"Credit Used",value:`₹${(s.creditUsed/1000).toFixed(0)}K/₹${(s.creditLimit/1000).toFixed(0)}K`,color:creditPct>80?"text-danger":"text-success"},
                      ].map(m=>(
                        <div key={m.label} className="bg-muted rounded-lg p-2 text-center">
                          <p className={`text-sm font-semibold ${m.color}`}>{m.value}</p>
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Credit Utilization</span><span className={creditPct>80?"text-danger":"text-muted-foreground"}>{creditPct}%</span></div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${creditPct>80?"bg-danger":creditPct>60?"bg-warning":"bg-success"}`} style={{width:`${creditPct}%`}}/>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>setDetailSupplier(s)} title="View details" className="px-3 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate flex items-center justify-center gap-1"><Eye className="h-3.5 w-3.5"/>View</button>
                    <button onClick={()=>{ setPoForm(f=>({...f,supplierName:s.name})); setShowAdd(true); }} className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30">New PO</button>
                    <button onClick={()=>{ setSearch(s.name); setTab("purchase-orders"); }} className="px-3 py-1.5 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-semibold hover-elevate">History</button>
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
            <div className="bg-danger-subtle border border-danger-border rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-danger shrink-0"/>
              <p className="text-sm text-danger">{overdueCount} invoice{overdueCount>1?"s":""} overdue. Please process payment immediately.</p>
            </div>
          )}
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  {["Invoice No.","PO Ref","Supplier","Amount","GST","Due Date","Status","Action"].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoiceList.map(inv=>{
                  const cfg = invStatusCfg(inv.status);
                  return (
                    <tr key={inv.id} onClick={()=>setDetailInvoice(inv)} title="Click for full invoice details" className={`cursor-pointer hover:bg-muted transition-colors ${inv.status==="overdue"?"bg-danger-subtle":""}`}>
                      <td className="py-3 pr-4 font-mono text-xs text-primary">{inv.id}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{inv.po}</td>
                      <td className="py-3 pr-4 font-semibold">{inv.supplier}</td>
                      <td className="py-3 pr-4 font-semibold text-primary">₹{inv.amount.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-muted-foreground">₹{inv.gst.toLocaleString()}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{inv.dueDate}</td>
                      <td className="py-3 pr-4"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${cfg.bg} ${cfg.color}`}>{inv.status}</span></td>
                      <td className="py-3" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button onClick={()=>setDetailInvoice(inv)} title="View invoice" className="h-7 w-7 rounded-lg bg-info-subtle text-info hover-elevate flex items-center justify-center shrink-0"><Eye className="h-3.5 w-3.5"/></button>
                          {inv.status!=="paid"&&<button onClick={()=>payInvoice(inv)} className="px-3 py-1 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate">Pay Now</button>}
                          {inv.status==="paid"&&<button onClick={()=>window.print()} className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted">Receipt</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PO Detail */}
      {selectedPO&&(
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-end" onClick={()=>setSelectedPO(null)}>
          <div className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div><h3 className="font-semibold">{selectedPO.id}</h3><p className="text-xs text-muted-foreground">{selectedPO.supplier}</p></div>
              <button onClick={()=>setSelectedPO(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
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
                  <div key={r.label} className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{r.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{r.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Items Ordered</p>
                <div className="rounded-lg border border-border">
                  <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-muted-foreground bg-muted border-b border-border">{["Item","Qty","Unit Price","Total"].map(h=><th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">
                        {selectedPO.items.map((item,i)=>(
                          <tr key={i} className="hover:bg-muted">
                            <td className="px-3 py-2.5 font-medium">{item.name}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{item.qty} {item.unit}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">₹{Number(item.price || 0).toLocaleString()}</td>
                            <td className="px-3 py-2.5 font-semibold text-primary">₹{Number(item.total || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted"><td colSpan={3} className="px-3 py-2.5 font-semibold">Total</td><td className="px-3 py-2.5 font-semibold text-primary">₹{selectedPO.total.toLocaleString()}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {selectedPO.status==="draft"&&<button onClick={()=>{updatePO(selectedPO.id,"pending");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-lg bg-info-subtle text-info font-semibold text-sm hover-elevate">Submit</button>}
                {selectedPO.status==="pending"&&<button onClick={()=>{updatePO(selectedPO.id,"approved");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-lg bg-success-subtle text-success font-semibold text-sm hover-elevate">Approve</button>}
                {selectedPO.status==="approved"&&<button onClick={()=>{updatePO(selectedPO.id,"in-transit");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground font-semibold text-sm hover-elevate">Mark Dispatched</button>}
                {selectedPO.status==="in-transit"&&<button onClick={()=>{updatePO(selectedPO.id,"delivered");setSelectedPO(null);}} className="flex-1 py-2.5 rounded-lg bg-success-subtle text-success font-semibold text-sm hover-elevate">Mark Delivered</button>}
                <button onClick={()=>window.print()} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold hover:bg-muted">Print PO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-lg border border-border p-5 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">New Purchase Order</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <input placeholder="Supplier name" value={poForm.supplierName} onChange={e => setPoForm(p => ({ ...p, supplierName: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Item name" value={poForm.itemName} onChange={e => setPoForm(p => ({ ...p, itemName: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min={1} placeholder="Qty" value={poForm.qty} onChange={e => setPoForm(p => ({ ...p, qty: Number(e.target.value) }))} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm" />
              <input type="number" min={0} placeholder="Unit price ₹" value={poForm.unitPrice} onChange={e => setPoForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={createPO} disabled={creatingPo || !poForm.supplierName || !poForm.itemName} className="w-full py-3 rounded-lg bg-primary font-semibold text-sm disabled:opacity-40">
              {creatingPo ? "Creating…" : `Create PO — ₹${(poForm.qty * poForm.unitPrice).toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      {/* Supplier full detail */}
      {detailSupplier && (() => {
        const s = detailSupplier;
        const creditPct = s.creditLimit > 0 ? Math.round((s.creditUsed / s.creditLimit) * 100) : 0;
        const rows: [string, string][] = [
          ["Supplier", s.name],
          ["Category", s.category || "—"],
          ["Contact person", s.contact || "—"],
          ["Phone", s.phone || "—"],
          ["Email", s.email || "—"],
          ["Payment terms", s.paymentTerms || "—"],
          ["Status", s.status === "inactive" ? "Inactive" : "Active"],
          ["Rating", s.rating == null ? "Not rated" : String(s.rating)],
          ["Total orders", String(s.totalOrders)],
          ["Total spend", `₹${s.totalSpend.toLocaleString("en-IN")}`],
          ["Last order", s.lastOrderAt || "Never ordered"],
          ["Credit limit", `₹${s.creditLimit.toLocaleString("en-IN")}`],
          ["Credit used", `₹${s.creditUsed.toLocaleString("en-IN")}`],
        ];
        return (
          <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailSupplier(null)}>
            <div className="w-full max-w-md bg-card rounded-lg border border-border text-foreground max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base flex items-center gap-2"><span className="h-8 w-8 rounded-lg bg-info-subtle flex items-center justify-center"><Building2 className="h-4 w-4 text-info" /></span>{s.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.category} · {s.paymentTerms} credit</p>
                </div>
                <button onClick={() => setDetailSupplier(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-2xs text-muted-foreground">{k}</p>
                      <p className="text-sm font-medium break-all">{v}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Credit Utilization</span><span className={creditPct > 80 ? "text-danger" : "text-muted-foreground"}>{creditPct}%</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${creditPct > 80 ? "bg-danger" : creditPct > 60 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(creditPct, 100)}%` }} />
                  </div>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setPoForm(f => ({ ...f, supplierName: s.name })); setShowAdd(true); setDetailSupplier(null); }} className="flex-1 py-2.5 rounded-lg bg-primary/20 text-primary text-sm font-semibold hover:bg-primary/30">New PO</button>
                  <button onClick={() => { setSearch(s.name); setTab("purchase-orders"); setDetailSupplier(null); }} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground text-sm font-semibold hover:bg-muted">View POs</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invoice full detail */}
      {detailInvoice && (() => {
        const inv = detailInvoice;
        const cfg = invStatusCfg(inv.status);
        const rows: [string, string][] = [
          ["Invoice No.", inv.id],
          ["PO Reference", inv.po],
          ["Supplier", inv.supplier],
          ["Amount", `₹${inv.amount.toLocaleString("en-IN")}`],
          // The old row added an invented 18% on top of a total that already carried tax.
          [inv.gstPercent ? `GST (${inv.gstPercent}%)` : "GST", `₹${inv.gst.toLocaleString("en-IN")}`],
          ["Total (incl. GST)", `₹${inv.grandTotal.toLocaleString("en-IN")}`],
          ["Due date", inv.dueDate || "—"],
          ["Status", inv.status],
          ["Paid on", inv.paidOn || "—"],
        ];
        return (
          <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailInvoice(null)}>
            <div className="w-full max-w-md bg-card rounded-lg border border-border text-foreground max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base flex items-center gap-2"><span className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" /></span>{inv.id}</h3>
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.bg} ${cfg.color}`}>{inv.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{inv.supplier}</p>
                </div>
                <button onClick={() => setDetailInvoice(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-2xs text-muted-foreground">{k}</p>
                      <p className="text-sm font-medium break-all capitalize">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {inv.status !== "paid" && <button onClick={() => { payInvoice(inv); setDetailInvoice(null); }} className="flex-1 py-2.5 rounded-lg bg-success-subtle text-success text-sm font-semibold hover-elevate">Pay Now</button>}
                  <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground text-sm font-semibold hover:bg-muted">Print / Receipt</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
