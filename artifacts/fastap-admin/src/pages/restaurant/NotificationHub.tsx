import { useState, useEffect, useCallback } from "react";
import { Bell, Send, Megaphone, Settings, CheckCircle, Clock, Users, Zap, X, Plus, Monitor, Smartphone, MessageSquare, AlertTriangle, Volume2, VolumeX, Filter, Eye, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { notificationsApi } from "@/lib/api";

type Tab = "center"|"broadcast"|"settings";

type NotificationItem = {
  id: string; type: string; title: string; body: string; time: string; read: boolean; priority: string; icon: string;
};

type BroadcastItem = { id: string; title: string; channel: string; recipients: number; sent: number; read: number; time: string };

const TYPE_ICONS: Record<string, string> = {
  order: "🍽️", stock: "⚠️", payment: "💳", staff: "👤", reservation: "📅", review: "⭐", finance: "🏦", system: "💾", sms: "📱", whatsapp: "💬", email: "📧", internal: "🔉",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function mapLog(row: any, readIds: Set<string>): NotificationItem {
  const type = row.type || row.metadata?.type || "system";
  const priority = row.metadata?.priority || (type === "stock" ? "high" : "normal");
  return {
    id: String(row.id),
    type,
    title: row.title || "Notification",
    body: row.message || "",
    time: row.createdAt ? timeAgo(row.createdAt) : "",
    read: readIds.has(String(row.id)),
    priority,
    icon: TYPE_ICONS[type] || "🔔",
  };
}

const TYPE_CFG: Record<string,{label:string;color:string;bg:string}> = {
  order:       {label:"Orders",     color:"text-amber-400",  bg:"bg-amber-500/15"},
  stock:       {label:"Inventory",  color:"text-red-400",    bg:"bg-red-500/15"},
  payment:     {label:"Payments",   color:"text-emerald-400",bg:"bg-emerald-500/15"},
  staff:       {label:"Staff",      color:"text-blue-400",   bg:"bg-blue-500/15"},
  reservation: {label:"Reservations",color:"text-violet-400",bg:"bg-violet-500/15"},
  review:      {label:"Reviews",    color:"text-yellow-400", bg:"bg-yellow-500/15"},
  finance:     {label:"Finance",    color:"text-teal-400",   bg:"bg-teal-500/15"},
  system:      {label:"System",     color:"text-white/50",   bg:"bg-white/10"},
};

const CHANNEL_CFG: Record<string,{icon:string;color:string;bg:string}> = {
  whatsapp: {icon:"💬",color:"text-emerald-400",bg:"bg-emerald-500/15"},
  sms:      {icon:"📱",color:"text-blue-400",   bg:"bg-blue-500/15"},
  email:    {icon:"📧",color:"text-violet-400", bg:"bg-violet-500/15"},
  push:     {icon:"🔔",color:"text-amber-400",  bg:"bg-amber-500/15"},
  internal: {icon:"🔉",color:"text-teal-400",  bg:"bg-teal-500/15"},
};

const DEFAULT_SETTINGS = {
  orderAlerts: true, stockAlerts: true, paymentAlerts: true, staffAlerts: true,
  reservationAlerts: true, reviewAlerts: true, financeAlerts: false, systemAlerts: false,
  soundEnabled: true, pushEnabled: true, emailEnabled: false, smsEnabled: false,
  orderThreshold: 3, stockThreshold: 20,
};

export default function NotificationHub() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("center");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [history, setHistory] = useState<BroadcastItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem("fastap_notif_read") || "[]")));
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [broadcast, setBroadcast] = useState({ title:"", body:"", channel:"internal", priority:"normal", audience:"all-staff" });
  const [sent, setSent] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setApiError(null);
    try {
      const rows = await notificationsApi.list(restaurantId);
      const storedRead = new Set<string>(JSON.parse(localStorage.getItem("fastap_notif_read") || "[]"));
      const items = Array.isArray(rows) ? rows.map(r => mapLog(r, storedRead)) : [];
      setNotifications(items);
      setHistory(items.filter(r => ["internal", "sms", "whatsapp", "email"].includes(r.type)).slice(0, 10).map(r => ({
        id: r.id,
        title: r.title,
        channel: r.type,
        recipients: 1,
        sent: 1,
        read: r.read ? 1 : 0,
        time: r.time,
      })));
    } catch {
      setApiError("Could not load notifications from server.");
      setNotifications([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const unread = notifications.filter(n=>!n.read).length;

  const filtered = notifications.filter(n=>
    (typeFilter==="all"||n.type===typeFilter) &&
    (!showUnreadOnly||!n.read)
  );

  function persistRead(ids: Set<string>) {
    localStorage.setItem("fastap_notif_read", JSON.stringify([...ids]));
  }

  function markRead(id:string) {
    const next = new Set(readIds); next.add(id);
    setReadIds(next); persistRead(next);
    setNotifications(n=>n.map(x=>x.id===id?{...x,read:true}:x));
  }
  function markAllRead() {
    const next = new Set(notifications.map(n => n.id));
    setReadIds(next); persistRead(next);
    setNotifications(n=>n.map(x=>({...x,read:true})));
  }
  function dismiss(id:string) { setNotifications(n=>n.filter(x=>x.id!==id)); }

  function toggleSetting(key:keyof typeof settings) {
    setSettings(s=>({...s,[key]:!s[key]}));
  }

  async function sendBroadcast() {
    if (!broadcast.title||!broadcast.body||!restaurantId) return;
    try {
      await notificationsApi.send(restaurantId, {
        type: broadcast.channel,
        title: broadcast.title,
        message: broadcast.body,
        recipientType: broadcast.audience,
        metadata: { priority: broadcast.priority, broadcast: true },
      });
      setSent(true);
      setTimeout(()=>setSent(false),3000);
      setBroadcast(b=>({...b,title:"",body:""}));
      await loadNotifications();
    } catch {
      setApiError("Failed to send broadcast.");
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold">Notification Hub</h1>
            {unread>0&&<span className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-xs font-extrabold">{unread}</span>}
          </div>
          <p className="text-xs text-white/40">Alerts, broadcasts and notification settings</p>
        </div>
        {unread>0&&<button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold transition-all"><CheckCircle className="h-4 w-4 text-emerald-400"/>Mark All Read</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Unread",value:unread,color:"text-red-400",bg:"bg-red-500/10"},
          {label:"Total Today",value:notifications.filter(n=>n.time.includes("m ago")||n.time.includes("h ago")).length,color:"text-white",bg:"bg-white/5"},
          {label:"High Priority",value:notifications.filter(n=>n.priority==="high").length,color:"text-orange-400",bg:"bg-orange-500/10"},
          {label:"System Healthy",value:"✓",color:"text-emerald-400",bg:"bg-emerald-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["center","Notification Center"],["broadcast","Broadcast"],["settings","Settings"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {apiError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{apiError}</div>}

      {tab==="center"&&(
        <>
          {loading && <div className="flex items-center gap-2 text-white/40 text-sm"><Loader className="h-4 w-4 animate-spin"/>Loading notifications...</div>}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1 flex-wrap">
              {["all","order","stock","payment","staff","reservation","review"].map(f=>(
                <button key={f} onClick={()=>setTypeFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${typeFilter===f?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{f==="all"?"All":f}</button>
              ))}
            </div>
            <button onClick={()=>setShowUnreadOnly(!showUnreadOnly)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${showUnreadOnly?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>
              <Eye className="h-3.5 w-3.5"/>Unread Only
            </button>
          </div>

          <div className="space-y-2">
            {filtered.map(n=>{
              const tcfg = TYPE_CFG[n.type]||{label:n.type,color:"text-white/50",bg:"bg-white/10"};
              return (
                <div key={n.id} className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all hover:border-white/10 ${!n.read?"border-white/10 bg-white/[0.04]":"border-white/5 bg-white/[0.02]"}`} onClick={()=>markRead(n.id)}>
                  <div className={`h-9 w-9 rounded-xl ${tcfg.bg} flex items-center justify-center text-lg shrink-0`}>{n.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${!n.read?"text-white":"text-white/60"}`}>{n.title}</p>
                      {!n.read&&<div className="h-2 w-2 rounded-full bg-amber-400 shrink-0"/>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-md ${n.priority==="high"?"bg-red-500/20 text-red-400":n.priority==="medium"?"bg-yellow-500/20 text-yellow-400":"bg-white/10 text-white/30"}`}>{n.priority}</span>
                    </div>
                    <p className={`text-xs mt-0.5 ${!n.read?"text-white/60":"text-white/30"}`}>{n.body}</p>
                    <p className="text-xs text-white/20 mt-1 flex items-center gap-1"><Clock className="h-3 w-3"/>{n.time}</p>
                  </div>
                  <button onClick={e=>{e.stopPropagation();dismiss(n.id);}} className="h-7 w-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-all shrink-0"><X className="h-3.5 w-3.5"/></button>
                </div>
              );
            })}
            {filtered.length===0&&<div className="text-center py-12 text-white/30"><Bell className="h-12 w-12 mx-auto mb-3 text-white/15"/><p>No notifications</p></div>}
          </div>
        </>
      )}

      {tab==="broadcast"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Send Broadcast</h3>
            {sent&&<div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2"><CheckCircle className="h-4 w-4"/>Broadcast sent successfully!</div>}
            <div className="space-y-4">
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Title</label>
                <input value={broadcast.title} onChange={e=>setBroadcast(p=>({...p,title:e.target.value}))} placeholder="Broadcast title..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Message</label>
                <textarea value={broadcast.body} onChange={e=>setBroadcast(p=>({...p,body:e.target.value}))} rows={4} placeholder="Write your message..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-white/20"/>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["internal","whatsapp","sms"] as const).map(ch=>{
                    const cfg = CHANNEL_CFG[ch];
                    return <button key={ch} onClick={()=>setBroadcast(p=>({...p,channel:ch}))} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${broadcast.channel===ch?`${cfg.bg} border-white/20 ${cfg.color}`:"border-white/10 bg-white/5 text-white/50"}`}><span className="text-xl">{cfg.icon}</span>{ch}</button>;
                  })}
                </div>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Target Audience</label>
                <div className="flex gap-2 flex-wrap">
                  {["all-staff","managers","kitchen","waiters","cashiers"].map(a=>(
                    <button key={a} onClick={()=>setBroadcast(p=>({...p,audience:a}))} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${broadcast.audience===a?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{a.replace("-"," ")}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["normal","high","urgent"].map(p=><button key={p} onClick={()=>setBroadcast(pr=>({...pr,priority:p}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${broadcast.priority===p?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/50"}`}>{p}</button>)}
                </div>
              </div>
              <button onClick={sendBroadcast} disabled={!broadcast.title||!broadcast.body} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-all">
                <Send className="h-4 w-4"/>Send Broadcast
              </button>
            </div>
          </div>

          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Broadcast History</h3>
            <div className="space-y-3">
              {history.map(h=>{
                const cfg = CHANNEL_CFG[h.channel]||CHANNEL_CFG.internal;
                const readRate = Math.round((h.read/h.sent)*100);
                return (
                  <div key={h.id} className="p-3 rounded-xl bg-white/5 border border-white/8">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{h.title}</p>
                        <p className="text-xs text-white/40">{h.time}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div><p className="font-bold text-white/70">{h.recipients}</p><p className="text-white/30">Recipients</p></div>
                      <div><p className="font-bold text-emerald-400">{h.sent}</p><p className="text-white/30">Delivered</p></div>
                      <div><p className="font-bold text-amber-400">{readRate}%</p><p className="text-white/30">Read Rate</p></div>
                    </div>
                  </div>
                );
              })}
              {history.length===0&&<p className="text-center text-white/30 text-sm py-6">No broadcasts sent yet</p>}
            </div>
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Alert Types</h3>
            <div className="space-y-3">
              {[
                {key:"orderAlerts",label:"New Order Alerts",desc:"When a new order is placed"},
                {key:"stockAlerts",label:"Low Stock Alerts",desc:"When inventory falls below minimum"},
                {key:"paymentAlerts",label:"Payment Notifications",desc:"When payments are received"},
                {key:"staffAlerts",label:"Staff Alerts",desc:"Late arrivals, absences"},
                {key:"reservationAlerts",label:"Reservation Alerts",desc:"New bookings and cancellations"},
                {key:"reviewAlerts",label:"Review Alerts",desc:"New customer reviews"},
                {key:"financeAlerts",label:"Finance Alerts",desc:"Settlements and payouts"},
                {key:"systemAlerts",label:"System Alerts",desc:"Backups, errors, maintenance"},
              ].map(({key,label,desc})=>(
                <div key={key} className="flex items-center justify-between">
                  <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-white/40">{desc}</p></div>
                  <button onClick={()=>toggleSetting(key as keyof typeof settings)} className={`h-6 w-11 rounded-full transition-all relative shrink-0 ${(settings as any)[key]?"bg-amber-500":"bg-white/10"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${(settings as any)[key]?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Delivery Channels</h3>
            <div className="space-y-3">
              {[
                {key:"soundEnabled",label:"In-App Sound",desc:"Play sound for new notifications",icon:Volume2},
                {key:"pushEnabled",label:"Push Notifications",desc:"Browser/app push alerts",icon:Smartphone},
                {key:"emailEnabled",label:"Email Notifications",desc:"Summary emails",icon:MessageSquare},
                {key:"smsEnabled",label:"SMS Alerts",desc:"Critical alerts via SMS",icon:Megaphone},
              ].map(({key,label,desc,icon:ChannelIcon})=>(
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/8">
                  <div className="flex items-center gap-3">
                    <ChannelIcon className="h-4 w-4 text-white/40"/>
                    <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-white/40">{desc}</p></div>
                  </div>
                  <button onClick={()=>toggleSetting(key as keyof typeof settings)} className={`h-6 w-11 rounded-full transition-all relative shrink-0 ${(settings as any)[key]?"bg-amber-500":"bg-white/10"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${(settings as any)[key]?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
