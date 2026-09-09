import { useState, useEffect, useCallback } from "react";
import { Building2, Users, MapPin, Plus, X, ChevronRight, Truck, DollarSign, CheckCircle, Store, Receipt } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { branches as branchesApi, planLimitMessage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import { PermissionGate } from "@/components/restaurant/PermissionGate";

type Branch = {
  id: string; name: string; city: string; manager: string; status: string;
  tables: number | null; revenue: number | null; orders: number | null; rating: number | null; staff: number | null;
  openSince: string; type: string;
};

function mapBranch(b: any): Branch {
  const created = b.createdAt ? new Date(b.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) : "—";
  // Per-branch operational metrics aren't returned by the branches API — keep them null
  // so the UI shows "—"/"N/A" instead of fabricated zeros. Use real values if present.
  const num = (v: any): number | null => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    id: String(b.id),
    name: b.name,
    city: b.address || "—",
    manager: b.phone || "—",
    status: b.isActive === false ? "inactive" : "active",
    tables: num(b.tableCount ?? b.tables),
    revenue: num(b.revenue ?? b.totalRevenue),
    orders: num(b.orders ?? b.orderCount),
    rating: num(b.rating ?? b.avgRating),
    staff: num(b.staffCount ?? b.staff),
    openSince: created,
    type: "company-owned",
  };
}

// Display helpers for possibly-missing per-branch metrics.
const revenueLabel = (v: number | null) => (v == null ? "N/A" : `₹${(v / 1000).toFixed(0)}K`);
const metricLabel = (v: number | null) => (v == null ? "—" : String(v));
const ratingLabel = (v: number | null) => (v == null ? "—" : String(v));

type FranchiseeRow = { id: string; name: string; branch: string; owner: string; royalty: number; status: string; dueDate: string; contract: string; phone: string };
type TransferRow = { id: string; from: string; to: string; items: string; status: string; date: string; requestedBy: string; value: number };
type AnalyticsRow = { metric: string; value: string; sub: string; trend: string; up: boolean };

type Tab = "branches"|"franchise"|"transfers"|"analytics";

export default function MultiBranchFranchise() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("branches");
  const [branchList, setBranchList] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Branch | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newBranch, setNewBranch] = useState({ name:"", city:"", manager:"", type:"company-owned" });
  const [editBranch, setEditBranch] = useState<{ id: string; name: string; city: string; manager: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [franchisees, setFranchisees] = useState<FranchiseeRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);

  const loadBranches = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [data, franchise, stockTransfers, branchAnalytics] = await Promise.all([
        branchesApi.list(restaurantId),
        branchesApi.franchise(restaurantId).catch(() => []),
        branchesApi.stockTransfers(restaurantId).catch(() => []),
        branchesApi.analytics(restaurantId).catch(() => []),
      ]);
      setBranchList((Array.isArray(data) ? data : []).map(mapBranch));
      setFranchisees(Array.isArray(franchise) ? franchise : []);
      setTransfers(Array.isArray(stockTransfers) ? stockTransfers : []);
      setAnalytics(Array.isArray(branchAnalytics) ? branchAnalytics : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  async function handleAddBranch() {
    if (!newBranch.name || !restaurantId) return;
    try {
      await branchesApi.create(restaurantId, {
        name: newBranch.name,
        address: newBranch.city,
        phone: newBranch.manager,
        isActive: true,
      });
      setNewBranch({ name:"", city:"", manager:"", type:"company-owned" });
      setShowAdd(false);
      await loadBranches();
      toast({ title: "Branch added" });
    } catch (e: any) {
      console.error(e);
      // A plan cap comes back as a 402 carrying the allowance and the current count.
      toast({ variant: "destructive", ...planLimitMessage(e, "Could not add branch") });
    }
  }

  function openManageBranch(branch: Branch) {
    setSelected(null);
    setEditBranch({ id: branch.id, name: branch.name, city: branch.city === "—" ? "" : branch.city, manager: branch.manager === "—" ? "" : branch.manager });
  }

  async function handleUpdateBranch() {
    if (!editBranch || !editBranch.name || !restaurantId) return;
    setSavingEdit(true);
    try {
      await branchesApi.update(restaurantId, parseInt(editBranch.id, 10), {
        name: editBranch.name,
        address: editBranch.city,
        phone: editBranch.manager,
      });
      setEditBranch(null);
      await loadBranches();
      toast({ title: "Branch updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not update branch", description: e?.message || "Failed to save branch changes." });
    } finally {
      setSavingEdit(false);
    }
  }

  async function markFranchisePaid(id: string) {
    if (!restaurantId) return;
    const updated = franchisees.map(f => f.id === id ? { ...f, status: "paid" as const } : f);
    try {
      await branchesApi.updateFranchise(restaurantId, updated);
      setFranchisees(updated);
      toast({ title: "Marked as paid" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not update franchise", description: e?.message || "Failed to record payment." });
    }
  }

  async function approveTransfer(id: string) {
    if (!restaurantId) return;
    const updated = transfers.map(t => t.id === id ? { ...t, status: "in-transit" as const } : t);
    try {
      await branchesApi.updateStockTransfers(restaurantId, updated);
      setTransfers(updated);
      toast({ title: "Transfer approved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not approve transfer", description: e?.message || "Failed to update the transfer." });
    }
  }

  const totalRevenue = isRestaurantPublished ? branchList.reduce((s,b)=>s+(b.revenue||0),0) : 0;
  const active = branchList.filter(b=>b.status==="active").length;
  const royaltyDue = isRestaurantPublished ? franchisees.filter(f => f.status !== "paid").reduce((s, f) => s + (f.royalty || 0), 0) : 0;
  const royaltyPaid = isRestaurantPublished ? franchisees.filter(f => f.status === "paid").reduce((s, f) => s + (f.royalty || 0), 0) : 0;
  const royaltyOverdue = isRestaurantPublished ? franchisees.filter(f => f.status === "overdue").reduce((s, f) => s + (f.royalty || 0), 0) : 0;

  if (loading && branchList.length === 0) {
    return <div className="p-6 text-center text-muted-foreground text-sm">Loading branches…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Branches & Franchise</h1>
          <p className="text-xs text-muted-foreground">{active} active branches · ₹{(totalRevenue/100000).toFixed(1)}L network revenue</p>
        </div>
        <PermissionGate permission="branch_wise_access">
          <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors">
            <Plus className="h-4 w-4"/>Add Branch
          </button>
        </PermissionGate>
      </div>

      {!isRestaurantPublished && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <p className="text-sm font-semibold text-primary">Branch analytics unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* Network Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Total Branches",value:branchList.length,icon:Building2,color:"text-info",bg:"bg-info-subtle"},
          {label:"Active Branches",value:active,icon:CheckCircle,color:"text-success",bg:"bg-success-subtle"},
          {label:"Network Revenue",value:isRestaurantPublished ? `₹${(totalRevenue/100000).toFixed(1)}L` : "₹0",icon:DollarSign,color:"text-primary",bg:"bg-primary/10"},
          {label:"Franchise Partners",value:franchisees.length,icon:Users,color:"text-muted-foreground",bg:"bg-muted"},
        ].map(s=>(
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-xl font-semibold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["branches","Branches"],["franchise","Franchise"],["transfers","Stock Transfers"],["analytics","Analytics"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab==="branches"&&(
        <div className="grid gap-4">
          {branchList.map(branch=>(
            <div key={branch.id} className="bg-card border border-border rounded-lg p-5 hover:border-border transition-colors cursor-pointer" onClick={()=>setSelected(branch)}>
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center text-xl shrink-0 ${branch.status==="active"?"bg-success-subtle text-success":"bg-danger-subtle text-danger"}`}><Store className="h-6 w-6" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">{branch.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${branch.status==="active"?"bg-success-subtle text-success":"bg-danger-subtle text-danger"}`}>{branch.status}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${branch.type==="franchise"?"bg-muted text-muted-foreground":"bg-info-subtle text-info"}`}>{branch.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <MapPin className="h-3 w-3"/>{branch.city} · Manager: {branch.manager} · {metricLabel(branch.tables)} tables
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {label:"Revenue",value:revenueLabel(branch.revenue),color:"text-primary"},
                      {label:"Orders",value:metricLabel(branch.orders),color:"text-info"},
                      {label:"Rating",value:ratingLabel(branch.rating),color:"text-warning"},
                      {label:"Staff",value:metricLabel(branch.staff),color:"text-muted-foreground"},
                    ].map(m=>(
                      <div key={m.label} className="bg-muted rounded-lg p-2 text-center">
                        <p className={`text-base font-semibold ${m.color}`}>{m.value}</p>
                        <p className="text-xs text-muted-foreground">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="franchise"&&(
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 mb-2">
            {[
              {label:"Total Royalty Due",value:`₹${royaltyDue.toLocaleString()}`,color:"text-primary"},
              {label:"Paid This Month",value:`₹${royaltyPaid.toLocaleString()}`,color:"text-success"},
              {label:"Overdue",value:`₹${royaltyOverdue.toLocaleString()}`,color:"text-danger"},
            ].map(s=>(
              <div key={s.label} className="bg-card border border-border rounded-lg p-3 text-center">
                <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          {franchisees.length === 0 ? <EmptyState title="No franchise partners" description="Franchise royalty records will appear here." /> : franchisees.map(f=>(
            <div key={f.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0"><Store className="h-6 w-6" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">{f.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${f.status==="paid"?"bg-success-subtle text-success":f.status==="due"?"bg-warning-subtle text-warning":"bg-danger-subtle text-danger"}`}>{f.status==="paid"?"Royalty Paid":f.status==="due"?"Payment Due":"OVERDUE"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Branch: {f.branch} · Owner: {f.owner} · Contract until {f.contract}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted rounded-lg p-2 text-center"><p className="text-base font-semibold text-primary">₹{f.royalty.toLocaleString()}</p><p className="text-xs text-muted-foreground">Royalty/mo</p></div>
                    <div className="bg-muted rounded-lg p-2 text-center"><p className="text-base font-semibold text-foreground">{f.dueDate}</p><p className="text-xs text-muted-foreground">Due Date</p></div>
                    <div className="bg-muted rounded-lg p-2 text-center"><p className="text-base font-semibold text-info">{f.phone}</p><p className="text-xs text-muted-foreground">Contact</p></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => f.status !== "paid" && markFranchisePaid(f.id)} disabled={f.status === "paid"} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${f.status!=="paid"?"bg-success-subtle text-success hover-elevate":"bg-muted text-muted-foreground"}`}>{f.status==="paid"?"Receipt":"Mark Paid"}</button>
                  <button disabled title="franchisee messaging endpoint not available" className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed">Message</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="transfers"&&(
        <div className="space-y-3">
          <div className="flex justify-end">
            <button disabled title="no endpoint to create a stock transfer request" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted text-sm font-semibold opacity-50 cursor-not-allowed">
              <Truck className="h-4 w-4 text-primary"/>Request Transfer
            </button>
          </div>
          {transfers.length === 0 ? <EmptyState title="No stock transfers" description="Inter-branch transfer requests will appear here." /> : transfers.map(t=>(
            <div key={t.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0"><Truck className="h-5 w-5 text-primary"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold">{t.from} to {t.to}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.status==="completed"?"bg-success-subtle text-success":t.status==="in-transit"?"bg-info-subtle text-info":"bg-warning-subtle text-warning"}`}>{t.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.items}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{t.date}</span><span>Requested by {t.requestedBy}</span><span className="text-primary">₹{t.value.toLocaleString()}</span>
                  </div>
                </div>
                {t.status==="pending"&&<button onClick={()=>approveTransfer(t.id)} className="px-3 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate">Approve</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="analytics"&&(
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {analytics.length === 0 || !isRestaurantPublished ? <EmptyState title={isRestaurantPublished ? "No branch analytics yet" : "No data available yet"} /> : analytics.map(a=>(
              <div key={a.metric} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">{a.metric}</p>
                  <span className={`text-xs font-semibold ${a.up?"text-success":"text-danger"}`}>{a.trend}</span>
                </div>
                <p className="text-xl font-semibold text-primary">{a.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Branch Performance Comparison</h3>
            <div className="space-y-4">
              {branchList.filter(b=>b.status==="active").sort((a,b)=>(b.revenue||0)-(a.revenue||0)).map((branch,i)=>{
                const pct = totalRevenue > 0 ? ((branch.revenue||0)/totalRevenue)*100 : 0;
                return (
                <div key={branch.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-semibold ${i===0?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground"}`}>{i+1}</span>
                      <span className="font-semibold">{branch.name}, {branch.city}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="text-primary font-semibold">{revenueLabel(branch.revenue)}</span>
                      <span>{ratingLabel(branch.rating)}</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-colors" style={{width:`${pct}%`}}/>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Branch Detail Drawer */}
      {selected&&(
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-end" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-md h-full bg-card border-l border-border overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div><h3 className="font-semibold">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.city}</p></div>
              <button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:"Revenue",value:revenueLabel(selected.revenue),color:"text-primary"},
                  {label:"Orders",value:metricLabel(selected.orders),color:"text-info"},
                  {label:"Rating",value:ratingLabel(selected.rating),color:"text-warning"},
                  {label:"Staff",value:metricLabel(selected.staff),color:"text-muted-foreground"},
                ].map(m=>(
                  <div key={m.label} className="bg-muted rounded-lg p-3 text-center border border-border">
                    <p className={`text-xl font-semibold ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-muted rounded-lg p-3 space-y-2 text-sm">
                {[
                  {label:"Manager",value:selected.manager},
                  {label:"Tables",value:metricLabel(selected.tables)},
                  {label:"Open Since",value:selected.openSince},
                  {label:"Type",value:selected.type==="franchise"?"Franchise Partner":"Company Owned"},
                ].map(r=>(
                  <div key={r.label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-semibold capitalize">{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button disabled title="per-branch reports endpoint not available" className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold opacity-50 cursor-not-allowed">View Reports</button>
                <button onClick={() => selected && openManageBranch(selected)} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm">Manage Branch</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAdd&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Add New Branch</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Branch Name",key:"name",placeholder:"e.g. Powai"},
                {label:"City",key:"city",placeholder:"e.g. Mumbai"},
                {label:"Manager Name",key:"manager",placeholder:"Manager's full name"},
              ].map(f=>(
                <div key={f.key}><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(newBranch as any)[f.key]} onChange={e=>setNewBranch(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                </div>
              ))}
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Branch Type</label>
                <div className="flex gap-2">
                  {["company-owned","franchise"].map(t=><button key={t} onClick={()=>setNewBranch(p=>({...p,type:t}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${newBranch.type===t?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{t}</button>)}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={handleAddBranch} disabled={!newBranch.name} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40">Add Branch</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage / Edit Branch Modal */}
      {editBranch&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Manage Branch</h2>
              <button onClick={()=>setEditBranch(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Branch Name",key:"name",placeholder:"e.g. Powai"},
                {label:"Address / City",key:"city",placeholder:"e.g. Mumbai"},
                {label:"Contact Phone",key:"manager",placeholder:"Branch contact number"},
              ].map(f=>(
                <div key={f.key}><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(editBranch as any)[f.key]} onChange={e=>setEditBranch(p=>p?{...p,[f.key]:e.target.value}:p)} placeholder={f.placeholder} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                </div>
              ))}
              <div className="flex gap-3">
                <button onClick={()=>setEditBranch(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={handleUpdateBranch} disabled={!editBranch.name||savingEdit} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40">{savingEdit?"Saving…":"Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
