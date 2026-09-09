import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { customers as customersApi, feedbackApi } from "@/lib/api";
import { Search, Plus, Star, Phone, Mail, MessageSquare, Gift, Crown, TrendingUp, Users, X, Filter, RefreshCw, Medal, Trophy, Gem, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TIER_CFG: Record<string, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  silver:     { label: "Silver",   icon: Medal, color: "text-muted-foreground",  bg: "bg-muted" },
  gold:       { label: "Gold",     icon: Trophy, color: "text-warning", bg: "bg-warning-subtle" },
  platinum:   { label: "Platinum", icon: Gem, color: "text-muted-foreground", bg: "bg-muted" },
  "vip-elite":{ label: "VIP",      icon: Crown, color: "text-warning", bg: "bg-warning-subtle" },
  new:        { label: "New",      icon: Sparkles, color: "text-info",   bg: "bg-info-subtle" },
  regular:    { label: "Regular",  icon: Star, color: "text-muted-foreground",   bg: "bg-muted" },
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
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Customer CRM</h1>
          <p className="text-xs text-muted-foreground">{customers.length} customers · ₹{Math.round(totalRevenue).toLocaleString()} total revenue</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-sm font-semibold shadow-sm transition-colors">
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Customers", value: customers.length, icon: Users, color: "text-info" },
          { label: "Total Revenue", value: `₹${Math.round(totalRevenue / 1000)}K`, icon: TrendingUp, color: "text-success" },
          { label: "Loyalty Points", value: totalPoints.toLocaleString(), icon: Gift, color: "text-primary" },
          { label: "Avg. Spend", value: `₹${Math.round(avgSpend)}`, icon: Crown, color: "text-muted-foreground" },
        ].map(card => (
          <div key={card.label} className="rounded-lg bg-card border border-border p-4">
            <card.icon className={`h-5 w-5 ${card.color} mb-2`} />
            <p className="text-2xl font-semibold">{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {(["customers", "segments", "feedback"] as Tab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${activeTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {activeTab === "customers" && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search by name or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              <option value="all">All Tiers</option>
              {Object.keys(TIER_CFG).map(t => <option key={t} value={t}>{TIER_CFG[t].label}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="h-8 w-8 border-2 border-primary/30 border-t-amber-500 rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No customers found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const tier = TIER_CFG[c.tier] || TIER_CFG.new;
                return (
                  <div key={c.id} onClick={() => setSelected(c)} className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border hover:bg-muted cursor-pointer transition-colors">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{c.name || "—"}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${tier.bg} ${tier.color}`}><tier.icon className="h-3 w-3" />{tier.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                        {c.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.mobile}</span>}
                        <span>{c.visits} visits</span>
                        <span>Last: {c.lastVisit}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-primary">₹{Math.round(c.totalSpend).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{c.points || 0} pts</p>
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
              <div key={key} className={`rounded-lg ${cfg.bg} border border-border p-4`}>
                <cfg.icon className={`h-6 w-6 ${cfg.color}`} />
                <p className={`text-xl font-semibold mt-2 ${cfg.color}`}>{count}</p>
                <p className="text-sm font-semibold">{cfg.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{count} customers</p>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "feedback" && (
        <div className="space-y-3">
          {feedback.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No feedback yet.</div>
          ) : (
            feedback.map((fb: any, i) => (
              <div key={i} className="p-4 rounded-lg bg-card border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{fb.customerName || "Guest"}</span>
                    <div className="flex">{Array.from({length: 5}).map((_, j) => <Star key={j} className={`h-3 w-3 ${j < fb.rating ? "text-primary fill-primary" : "text-muted-foreground"}`} />)}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString("en-IN")}</span>
                </div>
                {fb.comment && <p className="text-xs text-muted-foreground">{fb.comment}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="w-full max-w-sm bg-card rounded-lg p-6 border border-border space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Add Customer</h3>
              <button onClick={() => setShowAdd(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            {["name", "phone", "email"].map(field => (
              <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={(newCustomer as any)[field]} onChange={e => setNewCustomer(p => ({ ...p, [field]: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" />
            ))}
            <button onClick={handleAdd} className="w-full py-3 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm">Add Customer</button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="w-full max-w-sm bg-card rounded-lg p-6 border border-border max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">{(selected.name || "?").charAt(0)}</div>
                <div>
                  <h3 className="font-semibold">{selected.name}</h3>
                  <p className="text-xs text-muted-foreground">{(TIER_CFG[selected.tier] || TIER_CFG.new).label}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted"><p className="text-xs text-muted-foreground">Visits</p><p className="text-lg font-semibold">{selected.visits}</p></div>
              <div className="p-3 rounded-lg bg-muted"><p className="text-xs text-muted-foreground">Total Spend</p><p className="text-lg font-semibold text-primary">₹{Math.round(selected.totalSpend).toLocaleString()}</p></div>
              <div className="p-3 rounded-lg bg-muted"><p className="text-xs text-muted-foreground">Points</p><p className="text-lg font-semibold text-muted-foreground">{selected.points}</p></div>
              <div className="p-3 rounded-lg bg-muted"><p className="text-xs text-muted-foreground">Last Visit</p><p className="text-sm font-semibold">{selected.lastVisit}</p></div>
            </div>
            {selected.email && <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{selected.email}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
