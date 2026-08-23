import { useState, useEffect, useCallback } from "react";
import { Send, Bell, Plus, X, Users, TrendingUp, Clock, Target, Zap, Trash2, Pencil } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { marketing as marketingApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { useToast } from "@/hooks/use-toast";

type Tab = "campaigns"|"triggers"|"templates"|"analytics";

type Campaign = {
  id: string; name: string; channel: string; status: string; audience: number;
  sent: number; opened: number; clicks: number; revenue: number; scheduled: string; type: string;
  description: string; targetSegment: string;
};

function mapCampaign(c: any): Campaign {
  const channel = c.type?.includes("sms") ? "sms" : c.type?.includes("email") ? "email" : c.type?.includes("push") ? "push" : "whatsapp";
  let status = "draft";
  if (c.isActive) status = c.endDate && new Date(c.endDate) < new Date() ? "sent" : "active";
  else status = "draft";
  if (c.startDate && new Date(c.startDate) > new Date()) status = "scheduled";
  return {
    id: String(c.id),
    name: c.name,
    channel,
    status,
    audience: c.audience ?? 0,
    sent: c.sent ?? 0,
    opened: c.opened ?? 0,
    clicks: c.clicks ?? 0,
    revenue: c.revenue ?? 0,
    scheduled: c.startDate || "Manual",
    type: c.type || "promo",
    description: c.description || "",
    targetSegment: c.targetSegment || "All Customers",
  };
}

type TriggerRow = { id: string; name: string; event: string; channel: string; status: string; condition: string; fires: number; conversions: number; message: string };
type TemplateRow = { id: string; name: string; channel: string; category: string; body: string; usedIn: number };
type SegmentRow = { label: string; count: number; color: string };

const CHANNEL_CFG: Record<string,{icon:string;color:string;bg:string}> = {
  whatsapp: {icon:"💬",color:"text-emerald-400",bg:"bg-emerald-500/15"},
  sms:      {icon:"📱",color:"text-blue-400",   bg:"bg-blue-500/15"},
  email:    {icon:"📧",color:"text-violet-400", bg:"bg-violet-500/15"},
  push:     {icon:"🔔",color:"text-amber-400",  bg:"bg-amber-500/15"},
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  active:    {label:"Active",   color:"text-emerald-400",bg:"bg-emerald-500/15"},
  scheduled: {label:"Scheduled",color:"text-blue-400",   bg:"bg-blue-500/15"},
  sent:      {label:"Sent",     color:"text-teal-400",   bg:"bg-teal-500/15"},
  draft:     {label:"Draft",    color:"text-white/40",   bg:"bg-white/10"},
  paused:    {label:"Paused",   color:"text-yellow-400", bg:"bg-yellow-500/15"},
};

export default function MarketingAutomation() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRow | null>(null);
  const [newCampaign, setNewCampaign] = useState({ name:"", channel:"whatsapp", segment:"All Customers", message:"", scheduledFor:"" });
  const [busyId, setBusyId] = useState<string | null>(null);

  // Edit campaign modal state
  const [editId, setEditId] = useState<string | null>(null);
  const [editCampaign, setEditCampaign] = useState({ name:"", channel:"whatsapp", segment:"All Customers", message:"", scheduledFor:"" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);

  const loadCampaigns = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [data, automation] = await Promise.all([
        marketingApi.campaigns(restaurantId),
        marketingApi.automation(restaurantId).catch(() => null),
      ]);
      setCampaigns((Array.isArray(data) ? data : []).map(mapCampaign));
      if (automation) {
        if (Array.isArray(automation.triggers)) setTriggers(automation.triggers);
        if (Array.isArray(automation.templates)) setTemplates(automation.templates);
        if (Array.isArray(automation.segments)) setSegments(automation.segments);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load campaigns", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
    finally { setLoading(false); }
  }, [restaurantId, toast]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  async function handleCreateCampaign(launch = true) {
    if (!newCampaign.name || !restaurantId) return;
    try {
      await marketingApi.createCampaign(restaurantId, {
        name: newCampaign.name,
        type: newCampaign.channel,
        description: newCampaign.message,
        targetSegment: newCampaign.segment,
        isActive: launch,
        triggerType: "manual",
        startDate: newCampaign.scheduledFor || undefined,
      });
      setNewCampaign({ name:"", channel:"whatsapp", segment:"All Customers", message:"", scheduledFor:"" });
      setShowAdd(false);
      await loadCampaigns();
      toast({ title: launch ? "Campaign launched" : "Draft saved", description: `“${newCampaign.name}” was ${launch ? "launched" : "saved as draft"}.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to create campaign", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  // Pause / Resume / Launch — flip isActive on the campaign
  async function setCampaignActive(c: Campaign, isActive: boolean, verb: string) {
    if (!restaurantId) return;
    setBusyId(c.id);
    try {
      await marketingApi.updateCampaign(restaurantId, Number(c.id), { isActive });
      await loadCampaigns();
      toast({ title: `Campaign ${verb}`, description: `“${c.name}” is now ${isActive ? "active" : "paused"}.` });
    } catch (e) {
      console.error(e);
      toast({ title: `Failed to ${verb} campaign`, description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setBusyId(null); }
  }

  // Send Now — activate a scheduled campaign immediately (clear future start date)
  async function handleSendNow(c: Campaign) {
    if (!restaurantId) return;
    setBusyId(c.id);
    try {
      await marketingApi.updateCampaign(restaurantId, Number(c.id), { isActive: true, startDate: new Date().toISOString() });
      await loadCampaigns();
      toast({ title: "Campaign sent", description: `“${c.name}” is now sending.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to send campaign", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setBusyId(null); }
  }

  async function handleDeleteCampaign(c: Campaign) {
    if (!restaurantId) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete campaign “${c.name}”? This cannot be undone.`)) return;
    setBusyId(c.id);
    try {
      await marketingApi.deleteCampaign(restaurantId, Number(c.id));
      await loadCampaigns();
      toast({ title: "Campaign deleted", description: `“${c.name}” was removed.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to delete campaign", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setBusyId(null); }
  }

  function openEdit(c: Campaign) {
    setEditId(c.id);
    setEditCampaign({
      name: c.name,
      channel: c.channel,
      segment: c.targetSegment || "All Customers",
      message: c.description || "",
      scheduledFor: c.scheduled && c.scheduled !== "Manual" ? c.scheduled : "",
    });
  }

  async function handleSaveEdit() {
    if (!restaurantId || !editId) return;
    setSavingEdit(true);
    try {
      await marketingApi.updateCampaign(restaurantId, Number(editId), {
        name: editCampaign.name,
        type: editCampaign.channel,
        description: editCampaign.message,
        targetSegment: editCampaign.segment,
        startDate: editCampaign.scheduledFor || undefined,
      });
      setEditId(null);
      await loadCampaigns();
      toast({ title: "Campaign updated", description: `“${editCampaign.name}” was saved.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to update campaign", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setSavingEdit(false); }
  }

  // Auto-trigger On/Off — backed by the campaign's isActive flag
  async function toggleTrigger(t: TriggerRow) {
    if (!restaurantId) return;
    const nextActive = t.status !== "active";
    setBusyId(t.id);
    try {
      await marketingApi.updateCampaign(restaurantId, Number(t.id), { isActive: nextActive });
      await loadCampaigns();
      toast({ title: nextActive ? "Trigger enabled" : "Trigger paused", description: `“${t.name}” is now ${nextActive ? "on" : "off"}.` });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to update trigger", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally { setBusyId(null); }
  }

  // Template "Use" — prefill the composer with this template's channel + body
  function useTemplate(t: TemplateRow) {
    setNewCampaign(p => ({ ...p, name: t.name, channel: t.channel, message: t.body }));
    setSelectedTemplate(null);
    setShowAdd(true);
    setTab("campaigns");
  }

  // Segment chip — start a new campaign targeted at that segment
  function composeForSegment(label: string) {
    setNewCampaign(p => ({ ...p, segment: label }));
    setShowAdd(true);
    setTab("campaigns");
  }

  const totalSent = campaigns.reduce((s,c)=>s+c.sent,0);
  const totalRevenue = campaigns.reduce((s,c)=>s+c.revenue,0);
  const sentCampaigns = campaigns.filter(c=>c.sent>0);
  const avgOpenRate = sentCampaigns.length ? sentCampaigns.reduce((s,c)=>s+(c.opened/c.sent),0) / sentCampaigns.length : 0;
  const avgCTR = sentCampaigns.length ? sentCampaigns.reduce((s,c)=>s+(c.clicks/c.sent),0) / sentCampaigns.length : 0;

  if (loading && campaigns.length === 0) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading campaigns…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Marketing Automation</h1>
          <p className="text-xs text-white/40">Campaigns, triggers and customer engagement</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4"/>New Campaign
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Total Sent",value:totalSent.toLocaleString(),icon:Send,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Avg Open Rate",value:`${Math.round(avgOpenRate*100)}%`,icon:Bell,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Avg Click Rate",value:`${Math.round(avgCTR*100)}%`,icon:Target,color:"text-violet-400",bg:"bg-violet-500/10"},
          {label:"Revenue Driven",value:`₹${(totalRevenue/1000).toFixed(0)}K`,icon:TrendingUp,color:"text-amber-400",bg:"bg-amber-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["campaigns","Campaigns"],["triggers","Auto Triggers"],["templates","Templates"],["analytics","Analytics"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="campaigns"&&(
        <div className="space-y-3">
          {campaigns.map(c=>{
            const chcfg = CHANNEL_CFG[c.channel];
            const scfg = STATUS_CFG[c.status];
            const openRate = c.sent ? Math.round((c.opened/c.sent)*100) : 0;
            const ctr = c.sent ? Math.round((c.clicks/c.sent)*100) : 0;
            return (
              <div key={c.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl ${chcfg.bg} flex items-center justify-center text-xl shrink-0`}>{chcfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold">{c.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${chcfg.bg} ${chcfg.color}`}>{c.channel}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40 mb-3">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{c.audience} audience</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{c.scheduled}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        {label:"Sent",value:c.sent.toLocaleString(),color:"text-blue-400"},
                        {label:"Open Rate",value:`${openRate}%`,color:"text-emerald-400"},
                        {label:"CTR",value:`${ctr}%`,color:"text-violet-400"},
                        {label:"Revenue",value:c.revenue>0?`₹${(c.revenue/1000).toFixed(0)}K`:"—",color:"text-amber-400"},
                      ].map(m=>(
                        <div key={m.label} className="bg-white/5 rounded-lg p-2 text-center">
                          <p className={`text-sm font-extrabold ${m.color}`}>{m.value}</p>
                          <p className="text-xs text-white/30">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {c.status==="active"&&<button onClick={()=>setCampaignActive(c,false,"paused")} disabled={busyId===c.id} className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-semibold hover:bg-yellow-500/30 disabled:opacity-40">Pause</button>}
                    {c.status==="paused"&&<button onClick={()=>setCampaignActive(c,true,"resumed")} disabled={busyId===c.id} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-40">Resume</button>}
                    {c.status==="draft"&&<button onClick={()=>setCampaignActive(c,true,"launched")} disabled={busyId===c.id} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30 disabled:opacity-40">Launch</button>}
                    {c.status==="scheduled"&&<button onClick={()=>handleSendNow(c)} disabled={busyId===c.id} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 disabled:opacity-40">Send Now</button>}
                    <button onClick={()=>openEdit(c)} disabled={busyId===c.id} className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 text-xs font-semibold hover:bg-white/10 disabled:opacity-40"><Pencil className="h-3 w-3"/>Edit</button>
                    <button onClick={()=>handleDeleteCampaign(c)} disabled={busyId===c.id} className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-40"><Trash2 className="h-3 w-3"/>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="triggers"&&(
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-amber-400 shrink-0"/>
            <p className="text-sm text-amber-300">Triggers fire automatically based on customer behavior. They run 24/7 without manual action.</p>
          </div>
          <div className="space-y-3">
            {triggers.length === 0 ? <EmptyState title="No automation triggers" description="Create campaigns with trigger types to see automations." /> : triggers.map(t=>{
              const chcfg = CHANNEL_CFG[t.channel];
              const convRate = t.fires ? Math.round((t.conversions/t.fires)*100) : 0;
              return (
                <div key={t.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl ${chcfg.bg} flex items-center justify-center text-xl shrink-0`}>{chcfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold">{t.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${t.status==="active"?"bg-emerald-500/15 text-emerald-400":"bg-yellow-500/15 text-yellow-400"}`}>{t.status}</span>
                      </div>
                      <p className="text-xs text-white/40 mb-2">Trigger: {t.condition}</p>
                      <div className="text-xs bg-white/5 rounded-lg p-2.5 text-white/60 mb-3 font-mono">{t.message}</div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-white/40">{t.fires} fires</span>
                        <span className="text-emerald-400 font-semibold">{convRate}% conversion ({t.conversions})</span>
                      </div>
                    </div>
                    <button onClick={()=>toggleTrigger(t)} disabled={busyId===t.id} title={t.status==="active"?"Turn trigger off":"Turn trigger on"} className={`h-10 w-16 rounded-xl flex items-center justify-center border transition-all disabled:opacity-40 ${t.status==="active"?"bg-emerald-500/20 border-emerald-500/30 text-emerald-400":"bg-yellow-500/20 border-yellow-500/30 text-yellow-400"}`}>
                      {t.status==="active"?"On":"Off"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="templates"&&(
        <div className="space-y-4">
          {/* Audience Segments */}
          <div>
            <h3 className="text-sm font-bold text-white/70 mb-3">Audience Segments</h3>
            <div className="flex gap-2 flex-wrap">
              {segments.length === 0 ? <EmptyState title="No segments" /> : segments.map(s=>(
                <button key={s.label} onClick={()=>composeForSegment(s.label)} title={`New campaign for ${s.label}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all text-xs font-semibold">
                  <span className={`font-extrabold ${s.color}`}>{s.count}</span>
                  <span className="text-white/50">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {templates.length === 0 ? <EmptyState title="No message templates" /> : templates.map(t=>{
              const chcfg = CHANNEL_CFG[t.channel];
              return (
                <div key={t.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5 hover:border-white/10 cursor-pointer transition-all" onClick={()=>setSelectedTemplate(selectedTemplate?.id===t.id?null:t)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{chcfg.icon}</span>
                      <div>
                        <p className="font-bold text-sm">{t.name}</p>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                          <span className={`capitalize ${chcfg.color}`}>{t.channel}</span>
                          <span>·</span>
                          <span className="capitalize">{t.category}</span>
                          <span>·</span>
                          <span>Used in {t.usedIn} campaign{t.usedIn!==1?"s":""}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={(e)=>{e.stopPropagation();useTemplate(t);}} title="Start a campaign from this template" className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/30">Use</button>
                  </div>
                  <div className="text-xs bg-white/5 rounded-lg p-3 text-white/60">{t.body}</div>
                  {selectedTemplate?.id===t.id&&(
                    <div className="mt-3 pt-3 border-t border-white/8">
                      <p className="text-xs text-white/40 mb-2">Variables in this template:</p>
                      <div className="flex flex-wrap gap-1">
                        {(t.body.match(/\{[^}]+\}/g)||[]).map(v=><span key={v} className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">{v}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="analytics"&&(
        <div className="space-y-5">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
              <h3 className="font-bold mb-4">Channel Performance</h3>
              <div className="space-y-3">
                {Object.entries(CHANNEL_CFG).map(([channel,cfg])=>{
                  const cCampaigns = campaigns.filter(c=>c.channel===channel&&c.sent>0);
                  const openR = cCampaigns.length ? Math.round(cCampaigns.reduce((s,c)=>s+(c.sent>0?c.opened/c.sent:0),0)/cCampaigns.length*100) : 0;
                  return (
                    <div key={channel}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5"><span>{cfg.icon}</span><span className={`capitalize ${cfg.color}`}>{channel}</span></span>
                        <span className="text-white/50">{openR}% open rate</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{width:`${openR}%`}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
              <h3 className="font-bold mb-4">Campaign Performance</h3>
              <div className="space-y-3">
                {campaigns.filter(c=>c.sent>0).map(c=>(
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white/60 truncate max-w-32">{c.name}</span>
                      <span className="text-white/40">{c.sent>0?Math.round((c.opened/c.sent)*100):0}% open</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width:`${c.sent>0?Math.round((c.opened/c.sent)*100):0}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
              <h3 className="font-bold mb-4">Revenue by Campaign</h3>
              <div className="space-y-3">
                {campaigns.filter(c=>c.revenue>0).sort((a,b)=>b.revenue-a.revenue).map(c=>(
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-xl">{CHANNEL_CFG[c.channel]?.icon||"📢"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      <div className="h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{width:`${(c.revenue/totalRevenue)*100}%`}}/>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 shrink-0">₹{(c.revenue/1000).toFixed(0)}K</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Customer Engagement Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                {label:"Campaigns Run",value:campaigns.length,color:"text-white"},
                {label:"Total Reach",value:campaigns.reduce((s,c)=>s+c.audience,0).toLocaleString(),color:"text-blue-400"},
                {label:"Messages Sent",value:totalSent.toLocaleString(),color:"text-violet-400"},
                {label:"Total Opens",value:campaigns.reduce((s,c)=>s+c.opened,0).toLocaleString(),color:"text-emerald-400"},
                {label:"Total Clicks",value:campaigns.reduce((s,c)=>s+c.clicks,0).toLocaleString(),color:"text-amber-400"},
                {label:"Revenue",value:`₹${(totalRevenue/1000).toFixed(0)}K`,color:"text-amber-400"},
              ].map(s=>(
                <div key={s.label} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                  <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-white/30">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Campaign Modal */}
      {showAdd&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">New Campaign</h2>
              <button onClick={()=>setShowAdd(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Campaign Name</label>
                <input value={newCampaign.name} onChange={e=>setNewCampaign(p=>({...p,name:e.target.value}))} placeholder="e.g. Weekend Special Offer" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Channel</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["whatsapp","sms","email","push"] as const).map(c=>{
                    const cfg = CHANNEL_CFG[c];
                    return <button key={c} onClick={()=>setNewCampaign(p=>({...p,channel:c}))} className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold capitalize transition-all ${newCampaign.channel===c?`${cfg.bg} border-white/20 ${cfg.color}`:"border-white/10 bg-white/5 text-white/50"}`}><span className="text-xl">{cfg.icon}</span>{c}</button>;
                  })}
                </div>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Target Audience</label>
                <select value={newCampaign.segment} onChange={e=>setNewCampaign(p=>({...p,segment:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white">
                  {segments.map(s=><option key={s.label} value={s.label}>{s.label} ({s.count})</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Message</label>
                <textarea value={newCampaign.message} onChange={e=>setNewCampaign(p=>({...p,message:e.target.value}))} rows={4} placeholder="Write your message... Use {name} for personalization" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-white/20"/>
                <p className="text-xs text-white/30 mt-1 text-right">{newCampaign.message.length} chars</p>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={() => handleCreateCampaign(false)} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold">Save Draft</button>
                <button onClick={() => handleCreateCampaign(true)} disabled={!newCampaign.name} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">Launch Campaign</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {editId&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Edit Campaign</h2>
              <button onClick={()=>setEditId(null)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Campaign Name</label>
                <input value={editCampaign.name} onChange={e=>setEditCampaign(p=>({...p,name:e.target.value}))} placeholder="Campaign name" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Channel</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["whatsapp","sms","email","push"] as const).map(c=>{
                    const cfg = CHANNEL_CFG[c];
                    return <button key={c} onClick={()=>setEditCampaign(p=>({...p,channel:c}))} className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold capitalize transition-all ${editCampaign.channel===c?`${cfg.bg} border-white/20 ${cfg.color}`:"border-white/10 bg-white/5 text-white/50"}`}><span className="text-xl">{cfg.icon}</span>{c}</button>;
                  })}
                </div>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Target Audience</label>
                <select value={editCampaign.segment} onChange={e=>setEditCampaign(p=>({...p,segment:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white">
                  {segments.length===0 && <option value={editCampaign.segment}>{editCampaign.segment}</option>}
                  {segments.map(s=><option key={s.label} value={s.label}>{s.label} ({s.count})</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Message</label>
                <textarea value={editCampaign.message} onChange={e=>setEditCampaign(p=>({...p,message:e.target.value}))} rows={4} placeholder="Update the campaign message... Use {name} for personalization" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-white/20"/>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setEditId(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={handleSaveEdit} disabled={savingEdit || !editCampaign.name} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">{savingEdit?"Saving…":"Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
