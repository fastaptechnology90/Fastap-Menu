import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { customers as customersApi, feedbackApi } from "@/lib/api";
import {
  Search, Plus, Star, Phone, Mail, MessageSquare, Gift,
  Crown, TrendingUp, Users, X, Filter, RefreshCw
} from "lucide-react";

const TIER_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  silver:     { label: "Silver",   icon: "🥈", color: "text-slate-300",  bg: "bg-slate-500/20" },
  gold:       { label: "Gold",     icon: "🥇", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  platinum:   { label: "Platinum", icon: "💎", color: "text-violet-400", bg: "bg-violet-500/20" },
  "vip-elite":{ label: "VIP",      icon: "👑", color: "text-orange-400", bg: "bg-orange-500/20" },
  new:        { label: "New",      icon: "🆕", color: "text-blue-400",   bg: "bg-blue-500/20" },
  regular:    { label: "Regular",  icon: "⭐", color: "text-white/60",   bg: "bg-white/10" },
};

type Tab = "customers" | "segments" | "feedback";

export default function CustomerCRM() {
  const { restaurantId } = useRestaurant();
  const [activeTab, setActiveTab] = useState<Tab>("customers");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      customersApi.list(restaurantId).catch(() => []),
      feedbackApi.list(restaurantId).catch(() => []),
    ]).then(([cust, fb]) => {
      setCustomers(Array.isArray(cust) ? cust.map(c => ({ ...c, id: String(c.id), tier: c.segment || "new", visits: c.totalOrders || 0, totalSpend: parseFloat(String(c.totalSpend)) || 0, points: c.loyaltyPoints || 0, mobile: c.phone || "", lastVisit: c.lastVisit ? new Date(c.lastVisit).toLocaleDateString("en-IN") : "—" })) : []);
      setFeedback(Array.isArray(fb) ? fb : []);
    }).finally(() => setLoading(false));
  }, [restaurantId]);

  const filtered = customers.filter(c => {
    const searchMatch = !search || (c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.mobile || c.phone || "").includes(search);
    const tierMatch = tierFilter === "all" || c.tier === tierFilter;
    return searchMatch && tierMatch;
  });

  const totalRevenue = customers.reduce((s, c) => s + (c.totalSpend || 0), 0);
  const totalPoints = customers.reduce((s, c) => s + (c.points || c.loyaltyPoints || 0), 0);
  const avgSpend = customers.length ? totalRevenue / customers.length : 0;

  async function handleAdd() {
    if (!newCustomer.name || !restaurantId) return;
    await customersApi.create(restaurantId, { name: newCustomer.name, phone: newCustomer.phone, email: newCustomer.email });
    const data = await customersApi.list(restaurantId);
    setCustomers(Array.isArray(data) ? data.map(c => ({ ...c, id: String(c.id), tier: c.segment || "new", visits: c.totalOrders || 0, totalSpend: parseFloat(String(c.totalSpend)) || 0, points: c.loyaltyPoints || 0, mobile: c.phone || "", lastVisit: c.lastVisit ? new Date(c.lastVisit).toLocaleDateString("en-IN") : "—" })) : []);
    setNewCustomer({ name: "", phone: "", email: "" });
    setShowAdd(false);
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Customer CRM</h1>
          <p className="text-xs text-white/40">{customers.length} customers · ₹{Math.round(totalRevenue).toLocaleString()} total revenue</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Customers", value: customers.length, icon: Users, color: "text-blue-400" },
          { label: "Total Revenue", value: `₹${Math.round(totalRevenue / 1000)}K`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Loyalty Points", value: totalPoints.toLocaleString(), icon: Gift, color: "text-amber-400" },
          { label: "Avg. Spend", value: `₹${Math.round(avgSpend)}`, icon: Crown, color: "text-violet-400" },
        ].map(card => (
          <div key={card.label} className="rounded-2xl bg-white/[0.03] border border-white/8 p-4">
            <card.icon className={`h-5 w-5 ${card.color} mb-2`} />
            <p className="text-2xl font-extrabold">{card.value}</p>
            <p className="text-xs text-white/40">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
        {(["customers", "segments", "feedback"] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${activeTab === t ? "bg-amber-500 text-white" : "text-white/50 hover:text-white"}`}>{t}</button>
        ))}
      </div>

      {activeTab === "customers" && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search by name or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70">
              <option value="all">All Tiers</option>
              {Object.keys(TIER_CFG).map(t => <option key={t} value={t}>{TIER_CFG[t].label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="h-8 w-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-white/40">No customers found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const tier = TIER_CFG[c.tier] || TIER_CFG.new;
                return (
                  <div key={c.id} onClick={() => setSelected(c)} className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.06] cursor-pointer transition-all">
                    <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{c.name || "—"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}>{tier.icon} {tier.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/40 mt-0.5">
                        {c.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.mobile}</span>}
                        <span>{c.visits} visits</span>
                        <span>Last: {c.lastVisit}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-amber-400">₹{Math.round(c.totalSpend).toLocaleString()}</p>
                      <p className="text-xs text-white/30">{c.points || 0} pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "segments" && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(TIER_CFG).map(([key, cfg]) => {
            const count = customers.filter(c => c.tier === key).length;
            return (
              <div key={key} className={`rounded-2xl ${cfg.bg} border border-white/10 p-4`}>
                <span className="text-2xl">{cfg.icon}</span>
                <p className={`text-xl font-extrabold mt-2 ${cfg.color}`}>{count}</p>
                <p className="text-sm font-semibold">{cfg.label}</p>
                <p className="text-xs text-white/40 mt-0.5">{count} customers</p>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "feedback" && (
        <div className="space-y-3">
          {feedback.length === 0 ? (
            <div className="text-center py-12 text-white/40">No feedback yet.</div>
          ) : (
            feedback.map((fb: any, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/8 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{fb.customerName || "Guest"}</span>
                    <div className="flex">{Array.from({length: 5}).map((_, j) => <Star key={j} className={`h-3 w-3 ${j < fb.rating ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />)}</div>
                  </div>
                  <span className="text-xs text-white/30">{new Date(fb.createdAt).toLocaleDateString("en-IN")}</span>
                </div>
                {fb.comment && <p className="text-xs text-white/60">{fb.comment}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Add Customer</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-white/40" /></button>
            </div>
            {["name", "phone", "email"].map(field => (
              <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={(newCustomer as any)[field]} onChange={e => setNewCustomer(p => ({ ...p, [field]: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" />
            ))}
            <button onClick={handleAdd} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm">Add Customer</button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold">{(selected.name || "?").charAt(0)}</div>
                <div>
                  <h3 className="font-bold">{selected.name}</h3>
                  <p className="text-xs text-white/40">{(TIER_CFG[selected.tier] || TIER_CFG.new).label}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5 text-white/40" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5"><p className="text-xs text-white/40">Visits</p><p className="text-lg font-bold">{selected.visits}</p></div>
              <div className="p-3 rounded-xl bg-white/5"><p className="text-xs text-white/40">Total Spend</p><p className="text-lg font-bold text-amber-400">₹{Math.round(selected.totalSpend).toLocaleString()}</p></div>
              <div className="p-3 rounded-xl bg-white/5"><p className="text-xs text-white/40">Points</p><p className="text-lg font-bold text-violet-400">{selected.points}</p></div>
              <div className="p-3 rounded-xl bg-white/5"><p className="text-xs text-white/40">Last Visit</p><p className="text-sm font-bold">{selected.lastVisit}</p></div>
            </div>
            {selected.email && <div className="flex items-center gap-2 mt-3 text-xs text-white/40"><Mail className="h-3 w-3" />{selected.email}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
