import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { Monitor, Save, Check, ShoppingCart, CreditCard, Settings, BarChart3, Smartphone, Clock, TrendingUp, Plus, Minus, RefreshCw, X, Zap, QrCode, Bell, Coffee, Receipt, ArrowLeft, UtensilsCrossed, Nfc } from "lucide-react";
import { kioskApi, hardwareApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { publicationEmptyMessage } from "@/lib/restaurantPublication";
import { QRCodeSVG, downloadQrSvg } from "@/components/restaurant/QRCodeSVG";

const DEFAULT_SETTINGS = {
  enabled: true,
  showAllergens: true,
  showCalories: true,
  showNutri: false,
  multiLanguage: true,
  defaultLanguage: "English",
  upiEnabled: true,
  cardEnabled: true,
  cashEnabled: false,
  nfcEnabled: true,
  idleTimeout: 60,
  receiptPrint: true,
  receiptSms: true,
  themeColor: "#f97316",
  accentColor: "#ffffff",
  splashLogo: true,
  categoryScroll: "horizontal",
  showRecommended: true,
  customBanner: "Welcome to FastMenu! Tap to Order.",
  tipPrompt: true,
  tipOptions: [10, 20, 50],
  upsell: true,
};

type KioskStat = { label: string; value: string; sub: string; icon: typeof ShoppingCart; color: string; bg: string };
type KioskUnit = { id: string; label: string; location: string; status: string; orderCount: number; lastActivity: string };
type TopKioskItem = { name: string; orders: number; revenue: number };

type Tab = "overview"|"settings"|"units"|"preview";

export default function SelfOrderingKiosk() {
  const { restaurantId, restaurant, isRestaurantPublished } = useRestaurant();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [previewStep, setPreviewStep] = useState<"splash"|"menu"|"cart"|"payment"|"success">("splash");
  const [previewCart, setPreviewCart] = useState<{name:string;price:number;qty:number}[]>([]);

  const [kioskStats, setKioskStats] = useState<KioskStat[]>([]);
  const [topKioskItems, setTopKioskItems] = useState<TopKioskItem[]>([]);
  const [kioskUnits, setKioskUnits] = useState<KioskUnit[]>([]);
  const [qrModal, setQrModal] = useState<{ url: string; label: string } | null>(null);

  function formatLastActivity(ts?: string) {
    if (!ts) return "—";
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : new Date(ts).toLocaleDateString();
  }

  useEffect(() => {
    if (!restaurantId) return;
    kioskApi.settings(restaurantId).then((d:any) => {
      if (d && typeof d === "object" && !d.error) {
        // Read camelCase FIRST (what we save), falling back to the backend's snake_case
        // defaults — so saved toggles round-trip consistently across reload.
        setSettings(s=>({
          ...s,
          enabled: d.enabled ?? s.enabled,
          showAllergens: d.showAllergens ?? d.show_allergens ?? s.showAllergens,
          showCalories: d.showCalories ?? d.show_calories ?? s.showCalories,
          showNutri: d.showNutri ?? s.showNutri,
          multiLanguage: d.multiLanguage ?? s.multiLanguage,
          defaultLanguage: d.defaultLanguage ?? d.language ?? s.defaultLanguage,
          upiEnabled: d.upiEnabled ?? s.upiEnabled,
          cardEnabled: d.cardEnabled ?? s.cardEnabled,
          cashEnabled: d.cashEnabled ?? s.cashEnabled,
          nfcEnabled: d.nfcEnabled ?? s.nfcEnabled,
          idleTimeout: d.idleTimeout ?? d.idle_timeout ?? s.idleTimeout,
          receiptPrint: d.receiptPrint ?? s.receiptPrint,
          receiptSms: d.receiptSms ?? s.receiptSms,
          showRecommended: d.showRecommended ?? s.showRecommended,
          upsell: d.upsell ?? s.upsell,
          tipPrompt: d.tipPrompt ?? s.tipPrompt,
          customBanner: d.customBanner ?? d.welcome_message ?? s.customBanner,
          themeColor: d.themeColor ?? d.theme_color ?? s.themeColor,
        }));
      }
    }).catch(e => toast({ title: "Could not load the kiosk settings", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
    kioskApi.stats(restaurantId).then((d: any) => {
      if (!isRestaurantPublished || d?.isPublished === false) {
        setKioskStats([]);
        setTopKioskItems([]);
        return;
      }
      if (d && typeof d === "object") {
        const orders = d.today_orders ?? d.todayOrders ?? 0;
        const revenue = d.today_revenue ?? d.todayRevenue ?? 0;
        const aov = d.avg_order_value ?? d.avgOrderValue ?? (orders ? Math.round(revenue / orders) : 0);
        setKioskStats([
          { label:"Orders Today", value:String(orders), sub:`${d.sessions_today ?? d.sessionsToday ?? 0} kiosk sessions`, icon:ShoppingCart, color:"text-primary", bg:"bg-primary/10" },
          { label:"Revenue Today", value:`₹${Number(revenue).toLocaleString()}`, sub:`Avg ₹${aov}/order`, icon:TrendingUp, color:"text-success", bg:"bg-success-subtle" },
          { label:"Avg Order Time", value:d.avg_order_time ?? d.avgOrderTime ?? "—", sub:"From browse to pay", icon:Clock, color:"text-info", bg:"bg-info-subtle" },
          { label:"Popular Item", value:(d.popular_items?.[0] ?? d.popularItems?.[0] ?? "—"), sub:"Top kiosk seller", icon:Zap, color:"text-muted-foreground", bg:"bg-muted" },
        ]);
        if (Array.isArray(d.top_items)) setTopKioskItems(d.top_items);
        else if (Array.isArray(d.topItems)) setTopKioskItems(d.topItems);
      }
    }).catch(e => toast({ title: "Could not load the kiosk statistics", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
    hardwareApi.get(restaurantId).then((d: any) => {
      const devices = Array.isArray(d?.devices) ? d.devices.filter((x: any) => x.type === "kiosk") : [];
      setKioskUnits(devices.map((k: any) => ({
        id: String(k.id),
        label: k.name || `Kiosk ${k.id}`,
        location: k.location || "—",
        status: k.status === "online" ? "online" : "offline",
        orderCount: k.orderCount ?? 0,
        lastActivity: formatLastActivity(k.last_ping),
      })));
    }).catch(() => setKioskUnits([]));
  }, [restaurantId, isRestaurantPublished]);

  async function pingKiosk(id: string) {
    if (!restaurantId) return;
    try {
      await hardwareApi.ping(restaurantId, parseInt(id, 10));
      toast({ title: "Kiosk responded" });
    } catch (e) {
      toast({ title: "Kiosk did not respond", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
    const d = await hardwareApi.get(restaurantId).catch(() => null);
    const devices = Array.isArray(d?.devices) ? d.devices.filter((x: any) => x.type === "kiosk") : [];
    setKioskUnits(devices.map((k: any) => ({
      id: String(k.id),
      label: k.name || `Kiosk ${k.id}`,
      location: k.location || "—",
      status: k.status === "online" ? "online" : "offline",
      orderCount: k.orderCount ?? 0,
      lastActivity: formatLastActivity(k.last_ping),
    })));
  }

  async function showKioskQr(unit: KioskUnit) {
    if (!restaurantId) return;
    const data = await kioskApi.deviceQr(restaurantId, unit.id).catch(() => null);
    if (data?.url) setQrModal({ url: data.url, label: data.label || unit.label });
  }

  function toggle(key: keyof typeof settings) {
    setSettings(s=>({...s,[key]:!s[key]}));
  }

  async function saveSettings() {
    if (!restaurantId) return;
    try {
      // Save camelCase keys (same style the loader reads first) so toggles persist on reload.
      await kioskApi.updateSettings(restaurantId, settings);
      setSaved(true); setTimeout(()=>setSaved(false),2000);
      toast({ title: "Kiosk settings saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || "Could not save kiosk settings." });
    }
  }

  // Illustrative rows for the on-screen kiosk mock-up, so the owner can see the layout
  // while configuring it. Calories are left unset rather than invented — this used to
  // render Math.random() figures, which a diner at a real kiosk would have believed.
  const previewItems: { name: string; price: number; calories?: number }[] = [
    {name:"Butter Chicken",price:380},
    {name:"Gulab Jamun",price:120},
    {name:"Cold Coffee",price:110},
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Self-Ordering Kiosk</h1>
          <p className="text-xs text-muted-foreground">Configure, monitor and manage customer kiosks</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${settings.enabled?"bg-success-subtle text-success":"bg-danger-subtle text-danger"}`}>
            <div className={`h-2 w-2 rounded-full ${settings.enabled?"bg-success animate-pulse":"bg-danger"}`}/>
            Kiosks {settings.enabled?"Active":"Disabled"}
          </div>
          {tab==="settings"&&(
            <button onClick={saveSettings} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${saved?"bg-success text-background":"bg-primary hover:bg-primary/90 text-primary-foreground"}`}>
              {saved?<><Check className="h-4 w-4"/>Saved!</>:<><Save className="h-4 w-4"/>Save Settings</>}
            </button>
          )}
        </div>
      </div>

      {!isRestaurantPublished && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
          <p className="text-sm font-semibold text-primary">Kiosk analytics unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">{publicationEmptyMessage(restaurant.publicationStatus)}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["overview","Overview"],["settings","Settings"],["units","Kiosk Units"],["preview","Live Preview"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab==="overview"&&(
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kioskStats.length === 0 ? <div className="col-span-full"><EmptyState title={isRestaurantPublished ? "No kiosk stats yet" : "No data available yet"} /></div> : kioskStats.map(s=>(
              <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4 flex items-center gap-3`}>
                <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
                <div><p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xs text-muted-foreground">{s.sub}</p></div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-4">Top Items via Kiosk</h3>
              <div className="space-y-3">
                {topKioskItems.length === 0 ? <EmptyState title="No kiosk item data" /> : topKioskItems.map((item,i)=>(
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-lg bg-primary/20 text-primary text-xs font-semibold flex items-center justify-center shrink-0">#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{width:`${topKioskItems[0]?.orders ? (item.orders/topKioskItems[0].orders)*100 : 0}%`}}/>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-primary">₹{item.revenue.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{item.orders} orders</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-4">Kiosk Unit Status</h3>
              <div className="space-y-3">
                {kioskUnits.length === 0 ? <EmptyState title="No kiosk units registered" /> : kioskUnits.map(k=>(
                  <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${k.status==="online"?"bg-success-subtle":"bg-danger-subtle"}`}>
                      <Monitor className={`h-5 w-5 ${k.status==="online"?"text-success":"text-danger"}`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{k.label}</p>
                      <p className="text-xs text-muted-foreground">{k.location}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${k.status==="online"?"bg-success-subtle text-success":"bg-danger-subtle text-danger"}`}>{k.status}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{k.orderCount} orders · {k.lastActivity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          {[
            {title:"Display Features",items:[
              {key:"enabled",label:"Kiosks Enabled",desc:"Master switch for all kiosk units"},
              {key:"showAllergens",label:"Show Allergens",desc:"Display allergen info on menu items"},
              {key:"showCalories",label:"Show Calories",desc:"Show calorie count on each item"},
              {key:"showNutri",label:"Nutritional Info",desc:"Full nutrition panel on item details"},
              {key:"showRecommended",label:"Recommended Section",desc:"Show AI-suggested items at top"},
              {key:"upsell",label:"Upsell Prompts",desc:"Suggest add-ons at cart stage"},
              {key:"tipPrompt",label:"Tip Prompt",desc:"Ask for tip before payment"},
            ]},
            {title:"Payment Options",items:[
              {key:"upiEnabled",label:"UPI / QR Pay",desc:"Accept UPI payments at kiosk"},
              {key:"cardEnabled",label:"Card (Tap/Swipe)",desc:"Accept debit/credit cards"},
              {key:"cashEnabled",label:"Cash Payments",desc:"Enable cash collection at kiosk"},
              {key:"nfcEnabled",label:"NFC Tap Pay",desc:"Contactless NFC payments"},
            ]},
            {title:"Receipt & Notifications",items:[
              {key:"receiptPrint",label:"Print Receipt",desc:"Print paper receipt after order"},
              {key:"receiptSms",label:"SMS Receipt",desc:"Send order confirmation via SMS"},
            ]},
            {title:"Language & Accessibility",items:[
              {key:"multiLanguage",label:"Multi-Language Support",desc:"Show language selector to customers"},
            ]},
          ].map(section=>(
            <div key={section.title} className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold mb-4 text-foreground">{section.title}</h3>
              <div className="space-y-3">
                {section.items.map(({key,label,desc})=>(
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <button onClick={()=>toggle(key as keyof typeof settings)} className={`h-6 w-11 rounded-full transition-colors relative shrink-0 ${(settings as any)[key]?"bg-primary":"bg-muted"}`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-colors ${(settings as any)[key]?"left-[22px]":"left-0.5"}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Custom Banner */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4 text-foreground">Welcome Banner</h3>
            <textarea value={settings.customBanner} onChange={e=>setSettings(s=>({...s,customBanner:e.target.value}))} rows={2} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 resize-none"/>
          </div>

          {/* Theme Color */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4 text-foreground">Theme Color</h3>
            <div className="flex items-center gap-3">
              <input type="color" value={settings.themeColor} onChange={e=>setSettings(s=>({...s,themeColor:e.target.value}))} className="h-10 w-16 rounded-lg border border-border bg-muted cursor-pointer"/>
              <div>
                <p className="text-sm font-semibold">{settings.themeColor}</p>
                <p className="text-xs text-muted-foreground">Primary kiosk accent color</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==="units"&&(
        <div className="space-y-3">
          {kioskUnits.length === 0 ? <EmptyState title="No kiosk units registered" /> : kioskUnits.map(k=>(
            <div key={k.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-lg flex items-center justify-center ${k.status==="online"?"bg-success-subtle":"bg-danger-subtle"}`}>
                  <Monitor className={`h-7 w-7 ${k.status==="online"?"text-success":"text-danger"}`}/>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{k.label}</h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${k.status==="online"?"bg-success-subtle text-success":"bg-danger-subtle text-danger"}`}>{k.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{k.location}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{k.orderCount} orders today</span>
                    <span>Last active: {k.lastActivity}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => pingKiosk(k.id)} className="px-3 py-1.5 rounded-lg border border-border bg-muted text-xs font-semibold hover-elevate flex items-center gap-1"><RefreshCw className="h-3 w-3"/>Ping</button>
                  <button onClick={() => showKioskQr(k)} className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 flex items-center gap-1"><QrCode className="h-3 w-3"/>QR Code</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="preview"&&(
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Device Frame */}
          <div className="mx-auto" style={{width:360}}>
            <div className="rounded-[2.5rem] border-4 border-border bg-muted overflow-hidden shadow-xl" style={{height:640}}>
              <div className="h-full overflow-hidden relative">
                {previewStep==="splash"&&(
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center" style={{background:`${settings.themeColor}22`}}>
                    <div className="h-20 w-20 rounded-lg mb-6 flex items-center justify-center text-4xl" style={{background:settings.themeColor}}><Zap className="h-9 w-9 text-background" /></div>
                    <p className="text-2xl font-semibold mb-2">FastMenu</p>
                    <p className="text-sm text-muted-foreground mb-8">{settings.customBanner}</p>
                    <button onClick={()=>setPreviewStep("menu")} className="px-8 py-3.5 rounded-lg text-primary-foreground font-semibold text-lg" style={{background:settings.themeColor}}>Tap to Order</button>
                    {settings.multiLanguage&&<div className="flex gap-2 mt-6"><span className="text-xs bg-muted px-2 py-1 rounded-full">English</span><span className="text-xs bg-muted px-2 py-1 rounded-full">हिंदी</span><span className="text-xs bg-muted px-2 py-1 rounded-full">தமிழ்</span></div>}
                  </div>
                )}
                {previewStep==="menu"&&(
                  <div className="h-full flex flex-col bg-background">
                    <div className="p-4 border-b border-border" style={{background:`${settings.themeColor}20`}}>
                      <p className="font-semibold">Our Menu</p>
                      <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                        {["All","Starters","Main","Desserts","Drinks"].map(c=><span key={c} className="shrink-0 text-xs px-3 py-1 rounded-full border border-border text-muted-foreground">{c}</span>)}
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {previewItems.map(item=>(
                        <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                          <div className="h-9 w-9 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0"><UtensilsCrossed className="h-4 w-4" /></div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold">{item.name}</p>
                            {settings.showCalories && item.calories != null && <p className="text-xs text-muted-foreground">{item.calories} kcal</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold" style={{color:settings.themeColor}}>₹{item.price}</span>
                            <button onClick={()=>setPreviewCart(c=>{const ex=c.find(x=>x.name===item.name);if(ex)return c.map(x=>x.name===item.name?{...x,qty:x.qty+1}:x);return[...c,{name:item.name,price:item.price,qty:1}];})} className="h-7 w-7 rounded-lg flex items-center justify-center text-primary-foreground font-semibold" style={{background:settings.themeColor}}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {previewCart.length>0&&(
                      <div className="p-3 border-t border-border">
                        <button onClick={()=>setPreviewStep("cart")} className="w-full py-3 rounded-lg text-primary-foreground font-semibold flex items-center justify-center gap-2" style={{background:settings.themeColor}}>
                          <ShoppingCart className="h-4 w-4"/>View Cart ({previewCart.reduce((s,c)=>s+c.qty,0)} items)
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {previewStep==="cart"&&(
                  <div className="h-full flex flex-col bg-background">
                    <div className="flex items-center gap-2 p-4 border-b border-border">
                      <button onClick={()=>setPreviewStep("menu")} className="text-muted-foreground hover:text-foreground" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
                      <p className="font-semibold flex-1">Your Order</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {previewCart.map(c=>(
                        <div key={c.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                          <div className="flex-1"><p className="text-sm font-semibold">{c.name}</p></div>
                          <div className="flex items-center gap-2">
                            <button onClick={()=>setPreviewCart(prev=>prev.map(x=>x.name===c.name?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0))} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-xs">−</button>
                            <span className="text-sm font-semibold">{c.qty}</span>
                            <button onClick={()=>setPreviewCart(prev=>prev.map(x=>x.name===c.name?{...x,qty:x.qty+1}:x))} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center text-xs">+</button>
                          </div>
                          <span className="text-sm font-semibold" style={{color:settings.themeColor}}>₹{c.price*c.qty}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-border space-y-2">
                      <div className="flex justify-between font-semibold"><span>Total</span><span style={{color:settings.themeColor}}>₹{previewCart.reduce((s,c)=>s+c.price*c.qty,0)}</span></div>
                      <button onClick={()=>setPreviewStep("payment")} className="w-full py-3 rounded-lg text-primary-foreground font-semibold" style={{background:settings.themeColor}}>Proceed to Pay</button>
                    </div>
                  </div>
                )}
                {previewStep==="payment"&&(
                  <div className="h-full flex flex-col items-center justify-center p-6 bg-background">
                    <p className="font-semibold text-lg mb-6">Select Payment</p>
                    <div className="w-full space-y-3 mb-6">
                      {settings.upiEnabled&&<button onClick={()=>setPreviewStep("success")} className="w-full py-3 rounded-lg bg-info-subtle border border-info-border text-info font-semibold flex items-center justify-center gap-2"><Smartphone className="h-4 w-4" />UPI / QR Pay</button>}
                      {settings.cardEnabled&&<button onClick={()=>setPreviewStep("success")} className="w-full py-3 rounded-lg bg-muted border border-border text-muted-foreground font-semibold flex items-center justify-center gap-2"><CreditCard className="h-4 w-4"/>Card (Tap/Swipe)</button>}
                      {settings.nfcEnabled&&<button onClick={()=>setPreviewStep("success")} className="w-full py-3 rounded-lg bg-success-subtle border border-success-border text-success font-semibold flex items-center justify-center gap-2"><Nfc className="h-4 w-4" />NFC Tap</button>}
                    </div>
                    <button onClick={()=>setPreviewStep("cart")} className="inline-flex items-center gap-1.5 text-muted-foreground text-sm"><ArrowLeft className="h-3.5 w-3.5" />Back to cart</button>
                  </div>
                )}
                {previewStep==="success"&&(
                  <div className="h-full flex flex-col items-center justify-center p-6 bg-background text-center">
                    <div className="h-20 w-20 rounded-full bg-success-subtle border-2 border-success-border flex items-center justify-center mb-5 text-success"><Check className="h-9 w-9" /></div>
                    <p className="text-xl font-semibold text-success mb-2">Order Placed!</p>
                    <p className="text-sm text-muted-foreground mb-6">Your order is being prepared. Token: <strong>T47</strong></p>
                    {settings.receiptSms&&<p className="text-xs text-info mb-4"><Smartphone className="h-3 w-3 inline mb-0.5" /> Receipt sent via SMS</p>}
                    <button onClick={()=>{setPreviewStep("splash");setPreviewCart([]);}} className="w-full py-3 rounded-lg text-primary-foreground font-semibold" style={{background:settings.themeColor}}>New Order</button>
                  </div>
                )}
              </div>
            </div>
            {/* Nav dots */}
            <div className="flex justify-center gap-1.5 mt-3">
              {(["splash","menu","cart","payment","success"] as const).map(s=>(
                <button key={s} onClick={()=>setPreviewStep(s)} className={`h-2 rounded-full transition-colors ${previewStep===s?"w-5 bg-primary":"w-2 bg-muted"}`}/>
              ))}
            </div>
          </div>

          {/* Preview controls */}
          <div className="flex-1 space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-foreground">Preview Controls</h3>
              <div className="grid grid-cols-2 gap-2">
                {(["splash","menu","cart","payment","success"] as const).map(s=>(
                  <button key={s} onClick={()=>setPreviewStep(s)} className={`py-2 rounded-lg text-sm font-semibold capitalize border transition-colors ${previewStep===s?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground hover:border-border"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-3 text-foreground">Quick Toggles</h3>
              <div className="space-y-2">
                {([["showAllergens","Allergens"],["showCalories","Calories"],["upsell","Upsell"],["tipPrompt","Tip Prompt"]] as [keyof typeof settings, string][]).map(([k,l])=>(
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{l}</span>
                    <button onClick={()=>toggle(k)} className={`h-5 w-9 rounded-full transition-colors relative ${settings[k]?"bg-primary":"bg-muted"}`}>
                      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-colors ${settings[k]?"left-[17px]":"left-0.5"}`}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {qrModal && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setQrModal(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full text-center max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{qrModal.label}</h2>
              <button onClick={() => setQrModal(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="bg-white p-3 rounded-lg inline-block mb-3"><QRCodeSVG value={qrModal.url} size={180} /></div>
            <p className="text-xs text-muted-foreground break-all mb-4">{qrModal.url}</p>
            <button onClick={() => downloadQrSvg(qrModal.url, `kiosk-${qrModal.label}`)} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm">Download QR SVG</button>
          </div>
        </div>
      )}
    </div>
  );
}
