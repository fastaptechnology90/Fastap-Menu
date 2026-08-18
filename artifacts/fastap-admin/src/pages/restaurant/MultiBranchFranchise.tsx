import { useState, useEffect, useCallback } from "react";
import { Building2, Users, MapPin, Plus, X, ChevronRight, Truck, DollarSign, CheckCircle } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { branches as branchesApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import { PermissionGate } from "@/components/restaurant/PermissionGate";

type Branch = {
  id: string; name: string; city: string; manager: string; status: string;
  tables: number; revenue: number; orders: number; rating: number; staff: number;
  openSince: string; type: string;
};

function mapBranch(b: any): Branch {
  const created = b.createdAt ? new Date(b.createdAt).toLocaleDateString([], { month: "short", year: "numeric" }) : "—";
  return {
    id: String(b.id),
    name: b.name,
    city: b.address || "—",
    manager: b.phone || "—",
    status: b.isActive === false ? "inactive" : "active",
    tables: 0,
    revenue: 0,
    orders: 0,
    rating: 0,
    staff: 0,
    openSince: created,
    type: "company-owned",
  };
}

type FranchiseeRow = { id: string; name: string; branch: string; owner: string; royalty: number; status: string; dueDate: string; contract: string; phone: string };
type TransferRow = { id: string; from: string; to: string; items: string; status: string; date: string; requestedBy: string; value: number };
type AnalyticsRow = { metric: string; value: string; sub: string; trend: string; up: boolean };

type Tab = "branches"|"franchise"|"transfers"|"analytics";

export default function MultiBranchFranchise() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const [tab, setTab] = useState<Tab>("branches");
  const [branchList, setBranchList] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Branch | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newBranch, setNewBranch] = useState({ name:"", city:"", manager:"", type:"company-owned" });

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
    } catch (e) { console.error(e); }
  }

  async function markFranchisePaid(id: string) {
    if (!restaurantId) return;
    const updated = franchisees.map(f => f.id === id ? { ...f, status: "paid" as const } : f);
    await branchesApi.updateFranchise(restaurantId, updated);
    setFranchisees(updated);
  }

  async function approveTransfer(id: string) {
    if (!restaurantId) return;
    const updated = transfers.map(t => t.id === id ? { ...t, status: "in-transit" as const } : t);
    await branchesApi.updateStockTransfers(restaurantId, updated);
    setTransfers(updated);
  }

  const totalRevenue = isRestaurantPublished ? branchList.reduce((s,b)=>s+b.revenue,0) : 0;
  const active = branchList.filter(b=>b.status==="active").length;
  const royaltyDue = isRestaurantPublished ? franchisees.filter(f => f.status !== "paid").reduce((s, f) => s + (f.royalty || 0), 0) : 0;
  const royaltyPaid = isRestaurantPublished ? franchisees.filter(f => f.status === "paid").reduce((s, f) => s + (f.royalty || 0), 0) : 0;
  const royaltyOverdue = isRestaurantPublished ? franchisees.filter(f => f.status === "overdue").reduce((s, f) => s + (f.royalty || 0), 0) : 0;

  if (loading && branchList.length === 0) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading branches…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Branches & Franchise</h1>
          <p className="text-xs text-white/40">{active} active branches · ₹{(totalRevenue/100000).toFixed(1)}L network revenue</p>
        </div>
        <PermissionGate permission="branch_wise_access">
          <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
            <Plus className="h-4 w-4"/>Add Branch
          </button>
        </PermissionGate>
      </div>

      {!isRestaurantPublished && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-sm font-semibold text-amber-200">Branch analytics unavailable</p>
          <p className="text-xs text-white/50 mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* Network Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Total Branches",value:branchList.length,icon:Building2,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Active Branches",value:active,icon:CheckCircle,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Network Revenue",value:isRestaurantPublished ? `₹${(totalRevenue/100000).toFixed(1)}L` : "₹0",icon:DollarSign,color:"text-amber-400",bg:"bg-amber-500/10"},
          {label:"Franchise Partners",value:franchisees.length,icon:Users,color:"text-violet-400",bg:"bg-violet-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["branches","Branches"],["franchise","Franchise"],["transfers","Stock Transfers"],["analytics","Analytics"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="branches"&&(
        <div className="grid gap-4">
          {branchList.map(branch=>(
            <div key={branch.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all cursor-pointer" onClick={()=>setSelected(branch)}>
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${branch.status==="active"?"bg-emerald-500/15":"bg-red-500/15"}`}>🏪</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-extrabold">{branch.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${branch.status==="active"?"bg-emerald-500/20 text-emerald-400":"bg-red-500/20 text-red-400"}`}>{branch.status}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${branch.type==="franchise"?"bg-violet-500/20 text-violet-400":"bg-blue-500/20 text-blue-400"}`}>{branch.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/40 mb-3">
                    <MapPin className="h-3 w-3"/>{branch.city} · Manager: {branch.manager} · {branch.tables} tables
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {label:"Revenue",value:`₹${(branch.revenue/1000).toFixed(0)}K`,color:"text-amber-400"},
                      {label:"Orders",value:branch.orders,color:"text-blue-400"},
                      {label:"Rating",value:`${branch.rating}★`,color:"text-yellow-400"},
                      {label:"Staff",value:branch.staff,color:"text-violet-400"},
                    ].map(m=>(
                      <div key={m.label} className="bg-white/5 rounded-xl p-2 text-center">
                        <p className={`text-base font-extrabold ${m.color}`}>{m.value}</p>
                        <p className="text-xs text-white/30">{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/20 shrink-0 mt-1"/>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="franchise"&&(
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 mb-2">
            {[
              {label:"Total Royalty Due",value:`₹${royaltyDue.toLocaleString()}`,color:"text-amber-400"},
              {label:"Paid This Month",value:`₹${royaltyPaid.toLocaleString()}`,color:"text-emerald-400"},
              {label:"Overdue",value:`₹${royaltyOverdue.toLocaleString()}`,color:"text-red-400"},
            ].map(s=>(
              <div key={s.label} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 text-center">
                <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/40">{s.label}</p>
              </div>
            ))}
          </div>
          {franchisees.length === 0 ? <EmptyState title="No franchise partners" description="Franchise royalty records will appear here." /> : franchisees.map(f=>(
            <div key={f.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-violet-500/15 flex items-center justify-center text-xl shrink-0">🏪</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold">{f.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${f.status==="paid"?"bg-emerald-500/20 text-emerald-400":f.status==="due"?"bg-yellow-500/20 text-yellow-400":"bg-red-500/20 text-red-400"}`}>{f.status==="paid"?"Royalty Paid":f.status==="due"?"Payment Due":"OVERDUE"}</span>
                  </div>
                  <p className="text-xs text-white/40 mb-3">Branch: {f.branch} · Owner: {f.owner} · Contract until {f.contract}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-base font-bold text-amber-400">₹{f.royalty.toLocaleString()}</p><p className="text-xs text-white/30">Royalty/mo</p></div>
                    <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-base font-bold text-white/70">{f.dueDate}</p><p className="text-xs text-white/30">Due Date</p></div>
                    <div className="bg-white/5 rounded-lg p-2 text-center"><p className="text-base font-bold text-blue-400">{f.phone}</p><p className="text-xs text-white/30">Contact</p></div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => f.status !== "paid" && markFranchisePaid(f.id)} disabled={f.status === "paid"} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${f.status!=="paid"?"bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30":"bg-white/5 text-white/30"}`}>{f.status==="paid"?"Receipt":"Mark Paid"}</button>
                  <button className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/5 text-white/50 hover:bg-white/10">Message</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="transfers"&&(
        <div className="space-y-3">
          <div className="flex justify-end">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold">
              <Truck className="h-4 w-4 text-amber-400"/>Request Transfer
            </button>
          </div>
          {transfers.length === 0 ? <EmptyState title="No stock transfers" description="Inter-branch transfer requests will appear here." /> : transfers.map(t=>(
            <div key={t.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0"><Truck className="h-5 w-5 text-amber-400"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold">{t.from} → {t.to}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.status==="completed"?"bg-emerald-500/20 text-emerald-400":t.status==="in-transit"?"bg-blue-500/20 text-blue-400":"bg-yellow-500/20 text-yellow-400"}`}>{t.status}</span>
                  </div>
                  <p className="text-sm text-white/60">{t.items}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                    <span>{t.date}</span><span>Requested by {t.requestedBy}</span><span className="text-amber-400">₹{t.value.toLocaleString()}</span>
                  </div>
                </div>
                {t.status==="pending"&&<button onClick={()=>approveTransfer(t.id)} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30">Approve</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="analytics"&&(
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {analytics.length === 0 || !isRestaurantPublished ? <EmptyState title={isRestaurantPublished ? "No branch analytics yet" : "No data available yet"} /> : analytics.map(a=>(
              <div key={a.metric} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/40">{a.metric}</p>
                  <span className={`text-xs font-bold ${a.up?"text-emerald-400":"text-red-400"}`}>{a.trend}</span>
                </div>
                <p className="text-xl font-extrabold text-amber-400">{a.value}</p>
                <p className="text-xs text-white/30 mt-0.5">{a.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Branch Performance Comparison</h3>
            <div className="space-y-4">
              {branchList.filter(b=>b.status==="active").sort((a,b)=>b.revenue-a.revenue).map((branch,i)=>(
                <div key={branch.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${i===0?"bg-amber-500 text-black":"bg-white/10 text-white/60"}`}>{i+1}</span>
                      <span className="font-semibold">{branch.name}, {branch.city}</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/50">
                      <span className="text-amber-400 font-bold">₹{(branch.revenue/1000).toFixed(0)}K</span>
                      <span>{branch.rating}★</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500 transition-all" style={{width:`${(branch.revenue/totalRevenue)*100}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Branch Detail Drawer */}
      {selected&&(
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-end" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-md h-full bg-[#0e1520] border-l border-white/10 overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div><h3 className="font-extrabold">{selected.name}</h3><p className="text-xs text-white/40">{selected.city}</p></div>
              <button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:"Revenue",value:`₹${(selected.revenue/1000).toFixed(0)}K`,color:"text-amber-400"},
                  {label:"Orders",value:selected.orders,color:"text-blue-400"},
                  {label:"Rating",value:`${selected.rating}★`,color:"text-yellow-400"},
                  {label:"Staff",value:selected.staff,color:"text-violet-400"},
                ].map(m=>(
                  <div key={m.label} className="bg-white/5 rounded-xl p-3 text-center border border-white/8">
                    <p className={`text-xl font-extrabold ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-white/40">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white/5 rounded-xl p-3 space-y-2 text-sm">
                {[
                  {label:"Manager",value:selected.manager},
                  {label:"Tables",value:selected.tables},
                  {label:"Open Since",value:selected.openSince},
                  {label:"Type",value:selected.type==="franchise"?"Franchise Partner":"Company Owned"},
                ].map(r=>(
                  <div key={r.label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                    <span className="text-white/40">{r.label}</span>
                    <span className="font-semibold capitalize">{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">View Reports</button>
                <button className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Manage Branch</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAdd&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Add New Branch</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Branch Name",key:"name",placeholder:"e.g. Powai"},
                {label:"City",key:"city",placeholder:"e.g. Mumbai"},
                {label:"Manager Name",key:"manager",placeholder:"Manager's full name"},
              ].map(f=>(
                <div key={f.key}><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(newBranch as any)[f.key]} onChange={e=>setNewBranch(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                </div>
              ))}
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Branch Type</label>
                <div className="flex gap-2">
                  {["company-owned","franchise"].map(t=><button key={t} onClick={()=>setNewBranch(p=>({...p,type:t}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${newBranch.type===t?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/50"}`}>{t}</button>)}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={handleAddBranch} disabled={!newBranch.name} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">Add Branch</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
