import { useState, useEffect, useCallback } from "react";
import { Bell, Send, Megaphone, Settings, CheckCircle, Clock, Users, Zap, X, Plus, Monitor, Smartphone, MessageSquare, AlertTriangle, Volume2, VolumeX, Filter, Eye, Loader, Mail, UtensilsCrossed, CreditCard, User, Calendar, Star, Landmark, HardDrive, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { notificationsApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

type Tab = "center"|"broadcast"|"settings";

type NotificationItem = {
  id: string; type: string; title: string; body: string; time: string; read: boolean; priority: string; icon: LucideIcon;
};

type BroadcastItem = { id: string; title: string; channel: string; recipients: number; sent: number; read: number; time: string };

const TYPE_ICONS: Record<string, LucideIcon> = {
  order: UtensilsCrossed, stock: AlertTriangle, payment: CreditCard, staff: User, reservation: Calendar,
  review: Star, finance: Landmark, system: HardDrive, sms: Smartphone, whatsapp: MessageSquare,
  email: Mail, internal: Volume2,
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
    icon: TYPE_ICONS[type] || Bell,
  };
}

const TYPE_CFG: Record<string,{label:string;color:string;bg:string}> = {
  order:       {label:"Orders",     color:"text-primary",  bg:"bg-primary/15"},
  stock:       {label:"Inventory",  color:"text-danger",    bg:"bg-danger-subtle"},
  payment:     {label:"Payments",   color:"text-success",bg:"bg-success-subtle"},
  staff:       {label:"Staff",      color:"text-info",   bg:"bg-info-subtle"},
  reservation: {label:"Reservations",color:"text-muted-foreground",bg:"bg-muted"},
  review:      {label:"Reviews",    color:"text-warning", bg:"bg-warning-subtle"},
  finance:     {label:"Finance",    color:"text-success",   bg:"bg-success-subtle"},
  system:      {label:"System",     color:"text-muted-foreground",   bg:"bg-muted"},
};

const CHANNEL_CFG: Record<string,{icon:LucideIcon;color:string;bg:string}> = {
  whatsapp: {icon:MessageSquare,color:"text-success",bg:"bg-success-subtle"},
  sms:      {icon:Smartphone,color:"text-info",   bg:"bg-info-subtle"},
  email:    {icon:Mail,color:"text-muted-foreground", bg:"bg-muted"},
  push:     {icon:Bell,color:"text-primary",  bg:"bg-primary/15"},
  internal: {icon:Volume2,color:"text-success",  bg:"bg-success-subtle"},
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
  // Which channels the platform can actually deliver on. A venue switching on SMS with
  // no provider configured is being sold a switch that does nothing.
  const [channels, setChannels] = useState({ sound: true, push: true, email: true, sms: true });
  const [savingSetting, setSavingSetting] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState({ title:"", body:"", channel:"internal", priority:"normal", audience:"all-staff" });
  const [sent, setSent] = useState(false);

  // `silent` keeps the background poll from flashing the loading skeleton every 20s.
  const loadNotifications = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
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

  // These twelve toggles and two thresholds lived only in React state: nothing saved
  // them, nothing read them, and a refresh put them all back.
  useEffect(() => {
    if (!restaurantId) return;
    let live = true;
    notificationsApi.prefs(restaurantId)
      .then(r => {
        if (!live) return;
        setSettings({ ...DEFAULT_SETTINGS, ...r.preferences });
        setChannels(r.channelsAvailable);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [restaurantId]);

  // This page used to fetch once and never again, so a notification raised while it was
  // open (an order going ready, a staff auto-assignment) simply never appeared.
  useEffect(() => {
    loadNotifications();
    if (!restaurantId) return;
    const t = setInterval(() => loadNotifications(true), 20000);
    return () => clearInterval(t);
  }, [loadNotifications, restaurantId]);

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

  async function toggleSetting(key:keyof typeof settings) {
    if (!restaurantId) return;
    const before = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingSetting(key);
    try {
      const saved = await notificationsApi.savePrefs(restaurantId, { [key]: next[key] } as any);
      setSettings({ ...DEFAULT_SETTINGS, ...saved.preferences });
      setChannels(saved.channelsAvailable);
    } catch (e) {
      // Put the switch back where it was rather than leaving it showing a preference
      // the server never accepted.
      setSettings(before);
      toast({
        title: "Could not save that preference",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSetting(null);
    }
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
            <h1 className="text-xl font-semibold">Notification Hub</h1>
            {unread>0&&<span className="h-6 w-6 rounded-full bg-danger flex items-center justify-center text-xs font-semibold">{unread}</span>}
          </div>
          <p className="text-xs text-muted-foreground">Alerts, broadcasts and notification settings</p>
        </div>
        {unread>0&&<button onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted hover-elevate text-sm font-semibold transition-colors"><CheckCircle className="h-4 w-4 text-success"/>Mark All Read</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Unread",value:unread,color:"text-danger",bg:"bg-danger-subtle"},
          {label:"Total Today",value:notifications.filter(n=>n.time.includes("m ago")||n.time.includes("h ago")).length,color:"text-foreground",bg:"bg-muted"},
          {label:"High Priority",value:notifications.filter(n=>n.priority==="high").length,color:"text-warning",bg:"bg-warning-subtle"},
          {label:"System Healthy",value:"Yes",color:"text-success",bg:"bg-success-subtle"},
        ].map(s=>(
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["center","Notification Center"],["broadcast","Broadcast"],["settings","Settings"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {apiError && <div className="p-3 rounded-lg bg-danger-subtle border border-danger-border text-danger text-sm">{apiError}</div>}

      {tab==="center"&&(
        <>
          {loading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader className="h-4 w-4 animate-spin"/>Loading notifications...</div>}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1 flex-wrap">
              {["all","order","stock","payment","staff","reservation","review"].map(f=>(
                <button key={f} onClick={()=>setTypeFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${typeFilter===f?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{f==="all"?"All":f}</button>
              ))}
            </div>
            <button onClick={()=>setShowUnreadOnly(!showUnreadOnly)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${showUnreadOnly?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>
              <Eye className="h-3.5 w-3.5"/>Unread Only
            </button>
          </div>

          <div className="space-y-2">
            {filtered.map(n=>{
              const tcfg = TYPE_CFG[n.type]||{label:n.type,color:"text-muted-foreground",bg:"bg-muted"};
              return (
                <div key={n.id} className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors hover:border-border ${!n.read?"border-border bg-card":"border-border bg-card"}`} onClick={()=>markRead(n.id)}>
                  <div className={`h-9 w-9 rounded-lg ${tcfg.bg} ${tcfg.color} flex items-center justify-center shrink-0`}>{(() => { const TypeIcon = n.icon; return <TypeIcon className="h-4 w-4" />; })()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${!n.read?"text-foreground":"text-muted-foreground"}`}>{n.title}</p>
                      {!n.read&&<div className="h-2 w-2 rounded-full bg-primary shrink-0"/>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-md ${n.priority==="high"?"bg-danger-subtle text-danger":n.priority==="medium"?"bg-warning-subtle text-warning":"bg-muted text-muted-foreground"}`}>{n.priority}</span>
                    </div>
                    <p className={`text-xs mt-0.5 ${!n.read?"text-muted-foreground":"text-muted-foreground"}`}>{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3"/>{n.time}</p>
                  </div>
                  <button onClick={e=>{e.stopPropagation();dismiss(n.id);}} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors shrink-0"><X className="h-3.5 w-3.5"/></button>
                </div>
              );
            })}
            {filtered.length===0&&<div className="text-center py-12 text-muted-foreground"><Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground"/><p>No notifications</p></div>}
          </div>
        </>
      )}

      {tab==="broadcast"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Send Broadcast</h3>
            {sent&&<div className="mb-4 p-3 rounded-lg bg-success-subtle border border-success-border text-success text-sm font-semibold flex items-center gap-2"><CheckCircle className="h-4 w-4"/>Broadcast sent successfully!</div>}
            <div className="space-y-4">
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Title</label>
                <input value={broadcast.title} onChange={e=>setBroadcast(p=>({...p,title:e.target.value}))} placeholder="Broadcast title..." className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Message</label>
                <textarea value={broadcast.body} onChange={e=>setBroadcast(p=>({...p,body:e.target.value}))} rows={4} placeholder="Write your message..." className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-muted-foreground"/>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["internal","whatsapp","sms"] as const).map(ch=>{
                    const cfg = CHANNEL_CFG[ch];
                    return <button key={ch} onClick={()=>setBroadcast(p=>({...p,channel:ch}))} className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-semibold capitalize transition-colors ${broadcast.channel===ch?`${cfg.bg} border-border ${cfg.color}`:"border-border bg-muted text-muted-foreground"}`}><cfg.icon className="h-5 w-5" />{ch}</button>;
                  })}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Target Audience</label>
                <div className="flex gap-2 flex-wrap">
                  {["all-staff","managers","kitchen","waiters","cashiers"].map(a=>(
                    <button key={a} onClick={()=>setBroadcast(p=>({...p,audience:a}))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${broadcast.audience===a?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{a.replace("-"," ")}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["normal","high","urgent"].map(p=><button key={p} onClick={()=>setBroadcast(pr=>({...pr,priority:p}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${broadcast.priority===p?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{p}</button>)}
                </div>
              </div>
              <button onClick={sendBroadcast} disabled={!broadcast.title||!broadcast.body} className="w-full py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
                <Send className="h-4 w-4"/>Send Broadcast
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Broadcast History</h3>
            <div className="space-y-3">
              {history.map(h=>{
                const cfg = CHANNEL_CFG[h.channel]||CHANNEL_CFG.internal;
                const readRate = Math.round((h.read/h.sent)*100);
                return (
                  <div key={h.id} className="p-3 rounded-lg bg-muted border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <cfg.icon className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{h.title}</p>
                        <p className="text-xs text-muted-foreground">{h.time}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div><p className="font-semibold text-foreground">{h.recipients}</p><p className="text-muted-foreground">Recipients</p></div>
                      <div><p className="font-semibold text-success">{h.sent}</p><p className="text-muted-foreground">Delivered</p></div>
                      <div><p className="font-semibold text-primary">{readRate}%</p><p className="text-muted-foreground">Read Rate</p></div>
                    </div>
                  </div>
                );
              })}
              {history.length===0&&<p className="text-center text-muted-foreground text-sm py-6">No broadcasts sent yet</p>}
            </div>
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Alert Types</h3>
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
                  <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <button onClick={()=>toggleSetting(key as keyof typeof settings)} disabled={savingSetting!==null} className={`h-6 w-11 rounded-full transition-colors relative shrink-0 disabled:opacity-50 ${(settings as any)[key]?"bg-primary":"bg-muted"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-colors ${(settings as any)[key]?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Saved as you change them — these apply to everyone at this venue.</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Delivery Channels</h3>
            <div className="space-y-3">
              {[
                {key:"soundEnabled",label:"In-App Sound",desc:"Play sound for new notifications",icon:Volume2},
                {key:"pushEnabled",label:"Push Notifications",desc:"Browser/app push alerts",icon:Smartphone},
                {key:"emailEnabled",label:"Email Notifications",desc:"Summary emails",icon:MessageSquare},
                {key:"smsEnabled",label:"SMS Alerts",desc:"Critical alerts via SMS",icon:Megaphone},
              ].map(({key,label,desc,icon:ChannelIcon})=>{
                const channelKey = key.replace("Enabled","") as keyof typeof channels;
                const available = channels[channelKey] !== false;
                return (
                <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${available?"bg-muted border-border":"bg-card border-border"}`}>
                  <div className="flex items-center gap-3">
                    <ChannelIcon className={`h-4 w-4 ${available?"text-muted-foreground":"text-muted-foreground"}`}/>
                    <div>
                      <p className={`text-sm font-semibold ${available?"":"text-muted-foreground"}`}>{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {available ? desc : "No provider is configured for this channel yet, so nothing would be delivered."}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={()=>toggleSetting(key as keyof typeof settings)}
                    disabled={!available||savingSetting!==null}
                    title={available?undefined:"Ask your platform administrator to connect a provider first"}
                    className={`h-6 w-11 rounded-full transition-colors relative shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${(settings as any)[key]&&available?"bg-primary":"bg-muted"}`}
                  >
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-colors ${(settings as any)[key]&&available?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
