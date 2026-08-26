import { useState, useEffect, useCallback } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { corporateApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Building2, Plus, CreditCard, X, TrendingUp, DollarSign, AlertCircle, Download, Send, Search, Save, Eye } from "lucide-react";

type Account = {
  id: string; company: string; contactName: string; email: string; phone: string;
  creditLimit: number; creditUsed: number; employees: number; activeCards: number;
  gstNo: string; status: string; tier: string;
};

type Invoice = {
  id: string; account: string; period: string; amount: number; gst: number;
  total: number; status: string; dueDate: string; paidOn: string | null; meals: number;
};

type WalletCard = {
  id: string; employee: string; company: string; balance: number;
  monthlyLimit: number; usedThisMonth: number; lastUsed: string; status: string;
};

function mapAccount(a: any): Account {
  return {
    id: String(a.id),
    company: a.company,
    contactName: a.contact || a.contactName || "—",
    email: a.email || "—",
    phone: a.phone || "—",
    creditLimit: a.credit_limit ?? a.creditLimit ?? 0,
    creditUsed: a.outstanding ?? a.creditUsed ?? 0,
    employees: a.employees ?? 0,
    activeCards: a.activeCards ?? 0,
    gstNo: a.gst ?? a.gstNo ?? "",
    status: a.status || "active",
    tier: a.tier || (a.credit_limit > 150000 ? "enterprise" : "business"),
  };
}

function mapInvoice(i: any): Invoice {
  return {
    id: i.invoice_no || String(i.id),
    account: i.company || i.account || "—",
    period: i.period || "—",
    amount: i.amount ?? 0,
    gst: i.gst ?? 0,
    total: i.total ?? 0,
    status: i.status || "pending",
    dueDate: i.due_date || i.dueDate || "—",
    paidOn: i.paid_date || i.paidOn || null,
    meals: i.items ?? i.meals ?? 0,
  };
}

function mapWallet(w: any): WalletCard {
  const limit = w.monthly_limit ?? w.monthlyLimit ?? 0;
  const used = w.used ?? w.usedThisMonth ?? 0;
  return {
    id: String(w.id),
    employee: w.employee || "—",
    company: w.company || "—",
    balance: w.balance ?? 0,
    monthlyLimit: limit,
    usedThisMonth: used,
    lastUsed: w.lastUsed || "—",
    status: w.status || (used >= limit && limit > 0 ? "blocked" : "active"),
  };
}

const TIER_CFG: Record<string,{label:string;color:string;bg:string}> = {
  enterprise: {label:"Enterprise",color:"text-violet-400",bg:"bg-violet-500/15"},
  business:   {label:"Business",  color:"text-blue-400",  bg:"bg-blue-500/15"},
  starter:    {label:"Starter",   color:"text-white/50",  bg:"bg-white/10"},
};

type Tab = "accounts"|"invoices"|"wallets";

export default function CorporateBilling() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [walletCards, setWalletCards] = useState<WalletCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Account | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newAccount, setNewAccount] = useState({ company:"", contactName:"", email:"", phone:"", creditLimit:"", gstNo:"", tier:"business" });
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAccount, setEditAccount] = useState({ company:"", contactName:"", email:"", phone:"", creditLimit:"", gstNo:"", tier:"business" });
  const [editSaving, setEditSaving] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // No corporateApi method exists for this action — surface it clearly instead of faking success.
  const featureNeedsApi = (feature: string, endpoint: string) =>
    toast({ title: `${feature} needs an API`, description: `Requires ${endpoint}, which isn't available yet.`, variant: "destructive" });

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [acctData, invData, walletData] = await Promise.all([
        corporateApi.accounts(restaurantId),
        corporateApi.invoices(restaurantId),
        corporateApi.wallets(restaurantId),
      ]);
      setAccounts((Array.isArray(acctData) ? acctData : []).map(mapAccount));
      setInvoices((Array.isArray(invData) ? invData : []).map(mapInvoice));
      setWalletCards((Array.isArray(walletData) ? walletData : []).map(mapWallet));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreateAccount() {
    if (!newAccount.company || !restaurantId) return;
    try {
      await corporateApi.createAccount(restaurantId, {
        company: newAccount.company,
        contact: newAccount.contactName,
        email: newAccount.email,
        phone: newAccount.phone,
        credit_limit: parseFloat(newAccount.creditLimit) || 0,
        gst: newAccount.gstNo,
        employees: 0,
      });
      toast({ title: "Account created", description: `${newAccount.company} was added.` });
      setNewAccount({ company:"", contactName:"", email:"", phone:"", creditLimit:"", gstNo:"", tier:"business" });
      setShowAdd(false);
      await loadData();
    } catch (e: any) {
      toast({ title: "Could not create account", description: e?.message || "Please try again.", variant: "destructive" });
    }
  }

  function openEditAccount(acc: Account) {
    setEditingId(acc.id);
    setEditAccount({
      company: acc.company,
      contactName: acc.contactName === "—" ? "" : acc.contactName,
      email: acc.email === "—" ? "" : acc.email,
      phone: acc.phone === "—" ? "" : acc.phone,
      creditLimit: acc.creditLimit ? String(acc.creditLimit) : "",
      gstNo: acc.gstNo,
      tier: acc.tier,
    });
    setShowEdit(true);
  }

  async function submitEditAccount() {
    if (!editingId || !restaurantId || !editAccount.company) return;
    setEditSaving(true);
    try {
      await corporateApi.updateAccount(restaurantId, parseInt(editingId, 10), {
        company: editAccount.company,
        contact: editAccount.contactName,
        email: editAccount.email,
        phone: editAccount.phone,
        credit_limit: parseFloat(editAccount.creditLimit) || 0,
        gst: editAccount.gstNo,
        tier: editAccount.tier,
      });
      toast({ title: "Account updated", description: `${editAccount.company} was saved.` });
      setShowEdit(false);
      setSelected(null);
      setEditingId(null);
      await loadData();
    } catch (e: any) {
      toast({ title: "Could not update account", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  const totalBilled = invoices.reduce((s,i)=>s+i.total,0);
  const totalPending = invoices.filter(i=>i.status==="pending"||i.status==="overdue").reduce((s,i)=>s+i.total,0);
  const overdueCount = invoices.filter(i=>i.status==="overdue").length;

  const filteredAccounts = accounts.filter(a=>!search||a.company.toLowerCase().includes(search.toLowerCase())||a.contactName.toLowerCase().includes(search.toLowerCase()));
  const filteredInvoices = invoices.filter(i=>!search||i.account.toLowerCase().includes(search.toLowerCase())||i.id.toLowerCase().includes(search.toLowerCase()));

  if (loading && accounts.length === 0) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading corporate accounts…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Corporate Billing</h1>
          <p className="text-xs text-white/40">Corporate accounts, invoices and meal wallets</p>
        </div>
        {tab==="accounts"&&<button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all"><Plus className="h-4 w-4"/>Add Account</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Corporate Accounts",value:accounts.filter(a=>a.status==="active").length,icon:Building2,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Monthly Billed",value:`₹${(totalBilled/1000).toFixed(0)}K`,icon:TrendingUp,color:"text-amber-400",bg:"bg-amber-500/10"},
          {label:"Pending Payments",value:`₹${(totalPending/1000).toFixed(0)}K`,icon:DollarSign,color:"text-red-400",bg:"bg-red-500/10"},
          {label:"Active Meal Cards",value:walletCards.filter(w=>w.status==="active").length,icon:CreditCard,color:"text-emerald-400",bg:"bg-emerald-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
          </div>
        ))}
      </div>

      {overdueCount>0&&<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3"><AlertCircle className="h-5 w-5 text-red-400 shrink-0"/><p className="text-sm text-red-300">{overdueCount} invoice{overdueCount>1?"s":""} overdue. Total: ₹{invoices.filter(i=>i.status==="overdue").reduce((s,i)=>s+i.total,0).toLocaleString()}</p></div>}

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
          {([["accounts","Accounts"],["invoices","Invoices"],["wallets","Meal Wallets"]] as [Tab,string][]).map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
          <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>

      {tab==="accounts"&&(
        <div className="space-y-3">
          {filteredAccounts.map(acc=>{
            const creditPct = Math.round((acc.creditUsed/acc.creditLimit)*100);
            const tier = TIER_CFG[acc.tier];
            return (
              <div key={acc.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5 hover:border-white/10 cursor-pointer transition-all" onClick={()=>setSelected(acc)}>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/15 flex items-center justify-center shrink-0"><Building2 className="h-6 w-6 text-blue-400"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-extrabold">{acc.company}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tier.bg} ${tier.color}`}>{tier.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${acc.status==="active"?"bg-emerald-500/15 text-emerald-400":"bg-red-500/15 text-red-400"}`}>{acc.status}</span>
                    </div>
                    <p className="text-xs text-white/40 mb-3">{acc.contactName} · {acc.email} · {acc.employees} employees</p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        {label:"Credit Limit",value:`₹${(acc.creditLimit/1000).toFixed(0)}K`,color:"text-white/70"},
                        {label:"Used",value:`₹${(acc.creditUsed/1000).toFixed(0)}K`,color:creditPct>80?"text-red-400":"text-amber-400"},
                        {label:"Active Cards",value:acc.activeCards,color:"text-blue-400"},
                      ].map(m=>(
                        <div key={m.label} className="bg-white/5 rounded-lg p-2 text-center">
                          <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                          <p className="text-xs text-white/30">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-white/40">Credit Utilization</span><span className={creditPct>80?"text-red-400":"text-white/40"}>{creditPct}%</span></div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${creditPct>80?"bg-red-500":creditPct>60?"bg-yellow-500":"bg-emerald-500"}`} style={{width:`${creditPct}%`}}/></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="invoices"&&(
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/30 border-b border-white/5">
                  {["Invoice","Account","Period","Meals","Amount","GST","Total","Status","Action"].map(h=><th key={h} className="pb-3 pr-3 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredInvoices.map(inv=>(
                  <tr key={inv.id} onClick={()=>setViewInvoice(inv)} title="Click to view invoice details" className={`cursor-pointer hover:bg-white/5 transition-all ${inv.status==="overdue"?"bg-red-500/3":""}`}>
                    <td className="py-3 pr-3 font-mono text-xs text-amber-400">{inv.id}</td>
                    <td className="py-3 pr-3 font-semibold whitespace-nowrap">{inv.account}</td>
                    <td className="py-3 pr-3 text-xs text-white/50 whitespace-nowrap">{inv.period}</td>
                    <td className="py-3 pr-3 text-white/60">{inv.meals}</td>
                    <td className="py-3 pr-3 text-white/70">₹{inv.amount.toLocaleString()}</td>
                    <td className="py-3 pr-3 text-white/50">₹{inv.gst.toLocaleString()}</td>
                    <td className="py-3 pr-3 font-bold text-amber-400">₹{inv.total.toLocaleString()}</td>
                    <td className="py-3 pr-3"><span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${inv.status==="paid"?"bg-emerald-500/15 text-emerald-400":inv.status==="pending"?"bg-yellow-500/15 text-yellow-400":"bg-red-500/15 text-red-400"}`}>{inv.status}</span></td>
                    <td className="py-3" onClick={e=>e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button onClick={()=>setViewInvoice(inv)} title="View invoice" className="p-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"><Eye className="h-3.5 w-3.5"/></button>
                        <button onClick={()=>featureNeedsApi("Invoice download", "GET /restaurants/:id/corporate/invoices/:id/download")} title="Download PDF" className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/5"><Download className="h-3.5 w-3.5"/></button>
                        {inv.status!=="paid"&&<button onClick={()=>featureNeedsApi("Send invoice", "POST /restaurants/:id/corporate/invoices/:id/send")} title="Send to client" className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"><Send className="h-3.5 w-3.5"/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="wallets"&&(
        <div className="space-y-3">
          {walletCards.map(w=>{
            const usePct = Math.round((w.usedThisMonth/w.monthlyLimit)*100);
            return (
              <div key={w.id} className={`bg-[#0e1520] border rounded-2xl p-4 ${w.status==="blocked"?"border-red-500/20":"border-white/5"}`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${w.status==="active"?"bg-blue-500/15":"bg-red-500/15"}`}><CreditCard className={`h-5 w-5 ${w.status==="active"?"text-blue-400":"text-red-400"}`}/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold">{w.employee}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${w.status==="active"?"bg-emerald-500/15 text-emerald-400":"bg-red-500/15 text-red-400"}`}>{w.status}</span>
                    </div>
                    <p className="text-xs text-white/40 mb-2">{w.company} · Last used: {w.lastUsed}</p>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {[
                        {label:"Balance",value:`₹${w.balance.toLocaleString()}`,color:"text-emerald-400"},
                        {label:"Used/Month",value:`₹${w.usedThisMonth.toLocaleString()}`,color:"text-amber-400"},
                        {label:"Limit",value:`₹${(w.monthlyLimit/1000).toFixed(0)}K`,color:"text-white/60"},
                      ].map(m=>(
                        <div key={m.label} className="bg-white/5 rounded-lg p-1.5 text-center">
                          <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                          <p className="text-xs text-white/30">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-0.5"><span className="text-white/30">Monthly usage</span><span className={usePct>=100?"text-red-400":"text-white/30"}>{usePct}%</span></div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${usePct>=100?"bg-red-500":usePct>=80?"bg-yellow-500":"bg-blue-500"}`} style={{width:`${Math.min(100,usePct)}%`}}/></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={()=>featureNeedsApi("Wallet top-up", "PUT /restaurants/:id/corporate/wallets/:id")} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30">Top Up</button>
                    {w.status==="active"
                      ? <button onClick={()=>featureNeedsApi("Block card", "PUT /restaurants/:id/corporate/wallets/:id")} className="px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20">Block</button>
                      : <button onClick={()=>featureNeedsApi("Unblock card", "PUT /restaurants/:id/corporate/wallets/:id")} className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20">Unblock</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected&&(
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-end" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-md h-full bg-[#0e1520] border-l border-white/10 overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div><h3 className="font-extrabold">{selected.company}</h3><p className="text-xs text-white/40">{TIER_CFG[selected.tier].label} Account</p></div>
              <button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {label:"Contact",value:selected.contactName},{label:"Email",value:selected.email},
                  {label:"Phone",value:selected.phone},{label:"GST",value:selected.gstNo},
                  {label:"Employees",value:selected.employees},{label:"Active Cards",value:selected.activeCards},
                  {label:"Credit Limit",value:`₹${(selected.creditLimit/1000).toFixed(0)}K`},{label:"Credit Used",value:`₹${(selected.creditUsed/1000).toFixed(0)}K`},
                ].map(r=>(
                  <div key={r.label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/40">{r.label}</p>
                    <p className="text-sm font-semibold mt-0.5 break-all">{r.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>{ setSearch(selected.company); setTab("invoices"); setSelected(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold hover:bg-white/5">View Invoices</button>
                <button onClick={()=>openEditAccount(selected)} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Edit Account</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Add Corporate Account</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {label:"Company Name",key:"company",placeholder:"e.g. Accenture Ltd",col:"2"},
                {label:"Contact Person",key:"contactName",placeholder:"HR/Finance manager",col:"1"},
                {label:"Email",key:"email",placeholder:"billing@company.com",col:"1"},
                {label:"Phone",key:"phone",placeholder:"+91 XXXXX",col:"1"},
                {label:"GST Number",key:"gstNo",placeholder:"GSTIN",col:"1"},
                {label:"Credit Limit (₹)",key:"creditLimit",placeholder:"100000",col:"1"},
              ].map(f=>(
                <div key={f.key} className={f.col==="2"?"col-span-2":""}>
                  <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(newAccount as any)[f.key]} onChange={e=>setNewAccount(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Account Tier</label>
                <div className="flex gap-2">
                  {Object.entries(TIER_CFG).map(([t,c])=><button key={t} onClick={()=>setNewAccount(p=>({...p,tier:t}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${newAccount.tier===t?`${c.bg} border-white/20 ${c.color}`:"border-white/10 bg-white/5 text-white/50"}`}>{c.label}</button>)}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
              <button onClick={handleCreateAccount} disabled={!newAccount.company} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">Create Account</button>
            </div>
          </div>
        </div>
      )}

      {showEdit&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Edit Corporate Account</h2>
              <button onClick={()=>setShowEdit(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {label:"Company Name",key:"company",placeholder:"e.g. Accenture Ltd",col:"2"},
                {label:"Contact Person",key:"contactName",placeholder:"HR/Finance manager",col:"1"},
                {label:"Email",key:"email",placeholder:"billing@company.com",col:"1"},
                {label:"Phone",key:"phone",placeholder:"+91 XXXXX",col:"1"},
                {label:"GST Number",key:"gstNo",placeholder:"GSTIN",col:"1"},
                {label:"Credit Limit (₹)",key:"creditLimit",placeholder:"100000",col:"1"},
              ].map(f=>(
                <div key={f.key} className={f.col==="2"?"col-span-2":""}>
                  <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(editAccount as any)[f.key]} onChange={e=>setEditAccount(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Account Tier</label>
                <div className="flex gap-2">
                  {Object.entries(TIER_CFG).map(([t,c])=><button key={t} onClick={()=>setEditAccount(p=>({...p,tier:t}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${editAccount.tier===t?`${c.bg} border-white/20 ${c.color}`:"border-white/10 bg-white/5 text-white/50"}`}>{c.label}</button>)}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowEdit(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
              <button onClick={submitEditAccount} disabled={editSaving||!editAccount.company} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"><Save className="h-4 w-4"/>{editSaving?"Saving…":"Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setViewInvoice(null)}>
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 text-white" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-amber-400"/> Invoice {viewInvoice.id}</h3>
                <p className="text-xs text-white/40 mt-0.5">{viewInvoice.account} · {viewInvoice.period}</p>
              </div>
              <button onClick={()=>setViewInvoice(null)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-center py-2">
                <p className="text-3xl font-extrabold text-amber-400">₹{viewInvoice.total.toLocaleString()}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-2 inline-block ${viewInvoice.status==="paid"?"bg-emerald-500/15 text-emerald-400":viewInvoice.status==="pending"?"bg-yellow-500/15 text-yellow-400":"bg-red-500/15 text-red-400"}`}>{viewInvoice.status}</span>
              </div>
              {[
                ["Company / Account", viewInvoice.account],
                ["Billing period", viewInvoice.period],
                ["Meals billed", String(viewInvoice.meals)],
                ["Amount (pre-GST)", `₹${viewInvoice.amount.toLocaleString()}`],
                ["GST", `₹${viewInvoice.gst.toLocaleString()}`],
                ["Total", `₹${viewInvoice.total.toLocaleString()}`],
                ["Due date", viewInvoice.dueDate || "—"],
                ["Paid on", viewInvoice.paidOn || "—"],
              ].map(([k,v])=>(
                <div key={k as string} className="flex justify-between gap-3 border-b border-white/5 pb-2">
                  <span className="text-white/40">{k}</span>
                  <span className="font-medium text-right">{v as string}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={()=>featureNeedsApi("Invoice download", "GET /restaurants/:id/corporate/invoices/:id/download")} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/5 flex items-center justify-center gap-1"><Download className="h-4 w-4"/> Download</button>
                {viewInvoice.status!=="paid" && <button onClick={()=>featureNeedsApi("Send invoice", "POST /restaurants/:id/corporate/invoices/:id/send")} className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold hover:bg-emerald-500/25 flex items-center justify-center gap-1"><Send className="h-4 w-4"/> Send</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
