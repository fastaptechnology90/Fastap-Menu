import { useState, useEffect } from "react";
import { Leaf, Wine, Calendar, Clock, Users, Plus, X, CheckCircle, Star, Package, Droplets, FlaskConical, Scissors, Dumbbell, AlertTriangle, Check } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { spa as spaApi, barApi, staff as staffApi, roomService as roomServiceApi } from "@/lib/api";
import { FEATURES } from "@/lib/featureFlags";
import { ModulePackages } from "@/components/restaurant/ModulePackages";

type SpaBooking = {
  id: string; guest: string; room: string; service: string; therapist: string;
  time: string; status: string; amount: number; date: string; notes: string;
  phone?: string; email?: string; duration?: number; paymentStatus?: string; bookingType?: string;
  scheduledAt?: string; payment?: { method?: string; amount?: number; upiId?: string; utr?: string; reference?: string; collectedBy?: string; collectedAt?: string };
};
type SpaPackage = {
  id: string; name: string; duration: string; price: number; category: string;
  includes: string[]; therapists: string[]; available: boolean;
};
type BarItem = { id: string; name: string; category: string; price: number; stock: number; minStock: number; unit: string };
type CocktailRecipe = { name: string; ingredients: string[]; glass: string; garnish: string; prep: string };
type Therapist = { name: string; specialization: string; status: string; busyUntil?: string; bookingsToday: number };

const CATEGORY_CFG: Record<string,{label:string;icon:any;color:string}> = {
  massage:  {label:"Massage",   icon:Leaf,        color:"text-success"},
  couple:   {label:"Couples",   icon:Users,       color:"text-muted-foreground"},
  beauty:   {label:"Beauty",    icon:Scissors,    color:"text-muted-foreground"},
  wellness: {label:"Wellness",  icon:Dumbbell,    color:"text-info"},
  spirits:  {label:"Spirits",   icon:FlaskConical,color:"text-primary"},
  beer:     {label:"Beer",      icon:Wine,        color:"text-warning"},
  wine:     {label:"Wine",      icon:Wine,        color:"text-danger"},
  cocktail: {label:"Cocktails", icon:Droplets,    color:"text-info"},
  mocktail: {label:"Mocktails", icon:Droplets,    color:"text-success"},
};

type Tab = "spa-bookings"|"spa-packages"|"bar-orders"|"bar-inventory"|"recipes";

// mode splits this into a standalone Spa panel (spa role) and Bar panel (bar role).
// "both" keeps the legacy combined view for owner/manager (and the old /spa-bar route).
export default function SpaBar({ mode = "both" }: { mode?: "spa" | "bar" | "both" }) {
  const { restaurantId } = useRestaurant();
  const showSpa = mode !== "bar";
  const showBar = mode !== "spa";
  const [tab, setTab] = useState<Tab>(mode === "bar" ? "bar-orders" : "spa-bookings");
  const [bookings, setBookings] = useState<SpaBooking[]>([]);
  const [packages, setPackages] = useState<SpaPackage[]>([]);
  const [barItems, setBarItems] = useState<BarItem[]>([]);
  const [showAddBar, setShowAddBar] = useState(false);
  const [savingBar, setSavingBar] = useState(false);
  const [newBar, setNewBar] = useState({ name: "", category: "spirits", price: "", stock: "", minStock: "", unit: "bottle" });
  const [cocktailRecipes, setCocktailRecipes] = useState<CocktailRecipe[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [detailBooking, setDetailBooking] = useState<SpaBooking | null>(null);
  const [catFilter, setCatFilter] = useState("all");
  const [showBook, setShowBook] = useState(false);
  const [newBook, setNewBook] = useState({ guest:"", room:"", serviceId:"", therapist:"", time:"", notes:"", discount:"" });
  const [selectedRecipe, setSelectedRecipe] = useState<CocktailRecipe | null>(null);
  // Bar → room charge (WIP — gated)
  const [barCart, setBarCart] = useState<{ id:string; name:string; price:number; qty:number }[]>([]);
  const [barRoom, setBarRoom] = useState("");
  const [chargingBar, setChargingBar] = useState(false);

  const todayLabel = new Date().toLocaleDateString();

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      spaApi.bookings(restaurantId).catch(() => []),
      spaApi.services(restaurantId).catch(() => []),
      barApi.inventory(restaurantId).catch(() => []),
      barApi.recipes(restaurantId).catch(() => []),
      staffApi.list(restaurantId).catch(() => []),
    ]).then(([bookingRows, serviceRows, inventoryRows, recipeRows, staffRows]) => {
      const mappedBookings = (Array.isArray(bookingRows) ? bookingRows : []).map((b: any) => ({
        id: String(b.id),
        guest: b.customerName || b.guestName || "Guest",
        room: b.roomNumber || b.metadata?.roomNumber || "—",
        service: b.serviceName || b.notes || "Spa Service",
        therapist: b.therapist || "",
        time: b.scheduledAt ? new Date(b.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        status: b.status || "pending",
        amount: parseFloat(String(b.price || b.totalAmount || 0)),
        date: b.scheduledAt ? new Date(b.scheduledAt).toLocaleDateString() : todayLabel,
        notes: b.notes || "",
        phone: b.guestPhone || b.customerPhone || "",
        email: b.guestEmail || "",
        duration: Number(b.duration || 0),
        paymentStatus: b.paymentStatus || "pending",
        bookingType: b.bookingType || "single",
        scheduledAt: b.scheduledAt || "",
        payment: b.metadata?.payment,
      }));
      setBookings(mappedBookings);

      const mappedPackages = (Array.isArray(serviceRows) ? serviceRows : []).map((s: any) => ({
        id: String(s.id),
        name: s.name,
        duration: `${s.duration || 60} min`,
        price: parseFloat(String(s.price || 0)),
        category: s.category || "massage",
        includes: s.description ? [s.description] : [],
        therapists: s.therapist ? [s.therapist] : ["Any"],
        available: s.isAvailable !== false,
      }));
      setPackages(mappedPackages);
      if (mappedPackages.length && !newBook.serviceId) {
        setNewBook(nb => ({ ...nb, serviceId: mappedPackages[0].id }));
      }

      setBarItems((Array.isArray(inventoryRows) ? inventoryRows : []).map((i: any) => ({
        id: String(i.id ?? i.name),
        name: i.name,
        category: i.category || "spirits",
        price: parseFloat(String(i.price || 0)),
        stock: parseFloat(String(i.stock ?? i.currentStock ?? 0)),
        minStock: parseFloat(String(i.minStock ?? 0)),
        unit: i.unit || "unit",
      })));

      setCocktailRecipes((Array.isArray(recipeRows) ? recipeRows : []).map((r: any) => ({
        name: r.name,
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        glass: r.glass || "—",
        garnish: r.garnish || "—",
        prep: r.prep || r.instructions || "—",
      })));

      const spaStaff = (Array.isArray(staffRows) ? staffRows : []).filter((s: any) => s.role === "spa");
      const therapistNames = spaStaff.map((s: any) => s.name);
      setTherapists(spaStaff.map((s: any) => {
        const bookingsToday = mappedBookings.filter(b =>
          b.therapist === s.name && b.date === todayLabel && b.status !== "cancelled",
        ).length;
        const busy = mappedBookings.some(b => b.therapist === s.name && b.status === "confirmed");
        return {
          name: s.name,
          specialization: s.shift || "Spa therapist",
          status: busy ? "busy" : (s.isActive === false ? "offline" : "available"),
          bookingsToday,
        };
      }));
      if (therapistNames.length && !newBook.therapist) {
        setNewBook(nb => ({ ...nb, therapist: therapistNames[0] }));
      }
    });
  }, [restaurantId]);

  async function updateBooking(id: string, status: string) {
    if (!restaurantId) return;
    try {
      await spaApi.updateBooking(restaurantId, parseInt(id, 10), { status });
      setBookings(b => b.map(x => x.id === id ? { ...x, status } : x));
    } catch {
      /* keep UI unchanged */
    }
  }

  function addBarItem(item: BarItem) {
    setBarCart(c => {
      const ex = c.find(x => x.id === item.id);
      if (ex) return c.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  }
  const barCartTotal = barCart.reduce((s, c) => s + c.price * c.qty, 0);
  async function chargeBarToRoom() {
    if (!restaurantId || !barRoom.trim() || barCart.length === 0 || chargingBar) return;
    setChargingBar(true);
    try {
      await roomServiceApi.createRequest(restaurantId, {
        roomNumber: barRoom.trim(), type: "bar",
        items: barCart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
        notes: `Bar: ${barCart.map(c => `${c.qty}x ${c.name}`).join(", ")}`,
        total: barCartTotal, paymentMethod: "room_bill",
      });
      setBarCart([]); setBarRoom("");
    } catch (e) { console.error(e); }
    finally { setChargingBar(false); }
  }

  const spaRevenue = bookings.reduce((s,b)=>s+b.amount,0);
  const spaToday = bookings.filter(b => b.date === todayLabel).length;
  const spaPending = bookings.filter(b=>b.status==="pending").length;

  async function saveNewBarItem() {
    if (!restaurantId || !newBar.name.trim() || savingBar) return;
    setSavingBar(true);
    try {
      const item: BarItem = {
        id: `bar_${Date.now()}`,
        name: newBar.name.trim(),
        category: newBar.category,
        price: parseFloat(newBar.price) || 0,
        stock: parseFloat(newBar.stock) || 0,
        minStock: parseFloat(newBar.minStock) || 0,
        unit: newBar.unit || "unit",
      };
      const updated = [...barItems, item];
      await barApi.updateInventory(restaurantId, updated);
      setBarItems(updated);
      setNewBar({ name: "", category: "spirits", price: "", stock: "", minStock: "", unit: "bottle" });
      setShowAddBar(false);
    } catch (e) { console.error(e); }
    finally { setSavingBar(false); }
  }

  const lowStock = barItems.filter(i=>i.stock<i.minStock);
  const filteredBar = catFilter==="all" ? barItems : barItems.filter(i=>i.category===catFilter);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">{mode==="bar"?"Bar":mode==="spa"?"Spa":"Spa & Bar"}</h1>
          <p className="text-xs text-muted-foreground">{mode==="bar"?"Beverage & bar management":mode==="spa"?"Wellness & spa services":"Wellness services and beverage management"}</p>
        </div>
        {showSpa && (tab==="spa-bookings"||tab==="spa-packages")&&(
          <button onClick={()=>setShowBook(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors">
            <Plus className="h-4 w-4"/>Book Spa
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ...(showSpa ? [
            {label:"Today's Bookings",value:spaToday,color:"text-success",bg:"bg-success-subtle"},
            {label:"Spa Revenue",value:`₹${(spaRevenue/1000).toFixed(1)}K`,color:"text-primary",bg:"bg-primary/10"},
            {label:"Pending Sessions",value:spaPending,color:"text-warning",bg:"bg-warning-subtle"},
          ] : []),
          ...(showBar ? [
            {label:"Bar Items",value:barItems.length,color:"text-info",bg:"bg-info-subtle"},
            {label:"Cocktail Recipes",value:cocktailRecipes.length,color:"text-muted-foreground",bg:"bg-muted"},
            {label:"Bar Alerts (low stock)",value:lowStock.length,color:"text-danger",bg:"bg-danger-subtle"},
          ] : []),
        ].map(s=>(
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {showSpa && <ModulePackages restaurantId={restaurantId} module="spa" title="Spa Packages / Plans" label="Plan" />}
      {mode==="bar" && <ModulePackages restaurantId={restaurantId} module="bar" title="Bar Packages / Plans" label="Plan" />}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit overflow-x-auto no-scrollbar">
        {(([
          ...(showSpa ? [["spa-bookings","Spa Bookings"],["spa-packages","Packages & Therapists"]] : []),
          ...(showBar ? [["bar-orders","Bar Orders"],["bar-inventory","Bar Inventory"],["recipes","Cocktail Recipes"]] : []),
        ]) as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab==="spa-bookings"&&(
        <div className="space-y-3">
          {bookings.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No spa bookings yet. Create services and accept bookings from guests.</div>
          )}
          {bookings.map(b=>(
            <div key={b.id} onClick={()=>setDetailBooking(b)} title="Click for full guest details" className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-success-border transition-colors">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-success-subtle flex items-center justify-center shrink-0"><Leaf className="h-5 w-5 text-success"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold">{b.guest}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.status==="confirmed"?"bg-success-subtle text-success":b.status==="completed"?"bg-success-subtle text-success":"bg-warning-subtle text-warning"}`}>{b.status}</span>
                    {b.amount>0&&<span className="text-xs text-primary font-semibold">₹{b.amount}</span>}
                  </div>
                  <p className="text-sm text-foreground">{b.service}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{b.time}</span>
                    <span>Room: {b.room}</span>
                    <span>Therapist: {b.therapist}</span>
                  </div>
                  {b.notes&&<p className="text-xs text-warning mt-1"><AlertTriangle className="h-3 w-3 inline mb-0.5" /> {b.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0" onClick={e=>e.stopPropagation()}>
                  {b.status==="pending"&&<button onClick={()=>updateBooking(b.id,"confirmed")} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate">Confirm</button>}
                  {b.status==="confirmed"&&<button onClick={()=>updateBooking(b.id,"completed")} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Done</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="spa-packages"&&(
        <div className="space-y-5">
          {/* Therapist Availability */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Therapist Status</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {therapists.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">Add spa staff in Staff Management to see therapist availability.</p>
              )}
              {therapists.map(t=>(
                <div key={t.name} className={`rounded-lg border p-3 ${t.status==="available"?"border-success-border bg-success-subtle":"border-warning-border bg-warning-subtle"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${t.status==="available"?"bg-success":"bg-warning"}`}/>
                    <p className="text-sm font-semibold">{t.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.specialization}</p>
                  <p className={`text-xs mt-1 font-semibold ${t.status==="available"?"text-success":"text-warning"}`}>
                    {t.status==="available"?"Available":t.busyUntil?`Busy until ${t.busyUntil}`:"Busy"}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.bookingsToday} bookings today</p>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {["all","massage","couple","beauty","wellness"].map(c=>(
              <button key={c} onClick={()=>setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${catFilter===c?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{c==="all"?"All Services":c}</button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {packages.filter(p=>catFilter==="all"||p.category===catFilter).map(p=>{
              const cfg = CATEGORY_CFG[p.category]||CATEGORY_CFG.wellness;
              return (
                <div key={p.id} className={`bg-card border rounded-lg p-4 ${p.available?"border-border":"border-danger-border opacity-60"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{p.duration}</span>
                        <span className={`capitalize px-1.5 py-0.5 rounded-md bg-muted ${cfg.color}`}>{p.category}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-primary">₹{p.price.toLocaleString()}</p>
                      {!p.available&&<span className="text-xs text-danger">Not available</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.includes.map(inc=><span key={inc} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground inline-flex items-center gap-1"><Check className="h-3 w-3" />{inc}</span>)}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Therapists: {p.therapists.join(", ")}</p>
                    {p.available&&<button onClick={()=>setShowBook(true)} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate">Book Now</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="bar-orders"&&(
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {["all","spirits","beer","wine","cocktail","mocktail"].map(c=>(
              <button key={c} onClick={()=>setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${catFilter===c?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{c==="all"?"All Categories":c}</button>
            ))}
          </div>
          {FEATURES.hotelReception && (
            <div className="bg-card border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-semibold mb-1 flex items-center gap-2"><Wine className="h-4 w-4 text-primary"/>Charge to Room</p>
              <p className="text-xs text-muted-foreground mb-3">Neeche items pe click karke cart me daalo, room number bharo, phir Charge — bill us room ke folio me chala jayega.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input value={barRoom} onChange={e=>setBarRoom(e.target.value)} placeholder="Room No." className="w-28 bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                <div className="flex-1 min-w-0 text-xs text-muted-foreground truncate">{barCart.length ? barCart.map(c=>`${c.qty}x ${c.name}`).join(", ") : "No items yet — tap items below"}</div>
                <span className="text-sm font-semibold text-primary">₹{barCartTotal}</span>
                {barCart.length>0 && <button onClick={()=>setBarCart([])} className="text-xs text-muted-foreground hover:text-foreground px-2">Clear</button>}
                <button onClick={chargeBarToRoom} disabled={!barRoom.trim()||barCart.length===0||chargingBar} className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40">{chargingBar?"…":"Charge"}</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredBar.map(item=>{
              const cfg = CATEGORY_CFG[item.category]||CATEGORY_CFG.cocktail;
              return (
                <button key={item.id} onClick={FEATURES.hotelReception ? ()=>addBarItem(item) : undefined} className="bg-card border border-border rounded-lg p-4 text-left hover:border-border transition-colors">
                  <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-3 ${cfg.color}`}><cfg.icon className="h-5 w-5"/></div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-primary font-semibold mt-0.5">₹{item.price}</p>
                  <p className={`text-xs mt-1 ${item.stock<item.minStock?"text-danger":"text-muted-foreground"}`}>{item.stock<999?`Stock: ${item.stock} ${item.unit}${item.stock<item.minStock?" (low)":""}`:item.category}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab==="bar-inventory"&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Bar Products ({barItems.length})</p>
            <button onClick={()=>setShowAddBar(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors">
              <Plus className="h-4 w-4"/>Add Product
            </button>
          </div>
          {lowStock.length>0&&(
            <div className="bg-danger-subtle border border-danger-border rounded-lg p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-danger mb-2"><AlertTriangle className="h-4 w-4" />Low Stock Alerts ({lowStock.length} items)</p>
              <div className="flex flex-wrap gap-2">
                {lowStock.map(i=><span key={i.id} className="text-xs bg-danger-subtle text-danger px-2.5 py-1 rounded-full">{i.name} — {i.stock} left</span>)}
              </div>
            </div>
          )}
          {barItems.length===0 && (
            <div className="text-center py-12 text-muted-foreground text-sm border border-border rounded-lg bg-card">
              No bar products yet. Click "Add Product" to add spirits, beer, wine, cocktails etc.
            </div>
          )}
          {barItems.length>0 && (
          <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  {["Item","Category","Price","Stock","Min Stock","Status"].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {barItems.filter(i=>i.stock<999).map(item=>{
                  const isLow = item.stock<item.minStock;
                  return (
                    <tr key={item.id} className={`hover:bg-muted transition-colors ${isLow?"bg-danger-subtle":""}`}>
                      <td className="py-3 pr-4 font-semibold">{item.name}</td>
                      <td className="py-3 pr-4 capitalize text-muted-foreground">{item.category}</td>
                      <td className="py-3 pr-4 text-primary">₹{item.price}</td>
                      <td className="py-3 pr-4 font-semibold">{item.stock} <span className="text-muted-foreground font-normal">{item.unit}</span></td>
                      <td className="py-3 pr-4 text-muted-foreground">{item.minStock}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isLow?"bg-danger-subtle text-danger":"bg-success-subtle text-success"}`}>{isLow?"Low Stock":"OK"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {tab==="recipes"&&(
        <div className="grid lg:grid-cols-3 gap-4">
          {cocktailRecipes.map(recipe=>(
            <div key={recipe.name} className="bg-card border border-border rounded-lg p-5 hover:border-primary/20 cursor-pointer transition-colors" onClick={()=>setSelectedRecipe(selectedRecipe?.name===recipe.name?null:recipe)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{recipe.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Glass: {recipe.glass}</p>
                </div>
                <Wine className="h-5 w-5 text-primary"/>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Garnish: {recipe.garnish}</p>
              <div className="flex flex-wrap gap-1">
                {recipe.ingredients.slice(0,3).map(i=><span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">{i}</span>)}
                {recipe.ingredients.length>3&&<span className="text-xs text-muted-foreground">+{recipe.ingredients.length-3} more</span>}
              </div>
              {selectedRecipe?.name===recipe.name&&(
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">All Ingredients</p>
                    <div className="space-y-1">
                      {recipe.ingredients.map(i=><p key={i} className="text-xs text-foreground">• {i}</p>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Preparation</p>
                    <p className="text-xs text-foreground leading-relaxed">{recipe.prep}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Spa Booking Modal */}
      {showAddBar&&(
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowAddBar(false)}>
          <div className="w-full max-w-md bg-card rounded-lg border border-border max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><Wine className="h-5 w-5 text-primary"/> Add bar product</h3>
              <button onClick={()=>setShowAddBar(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Product name <span className="text-danger">*</span></label>
                <input value={newBar.name} onChange={e=>setNewBar(p=>({...p,name:e.target.value}))} placeholder="e.g. Old Monk Rum" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Category</label>
                  <select value={newBar.category} onChange={e=>setNewBar(p=>({...p,category:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                    {["spirits","beer","wine","cocktail","mocktail"].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Unit</label>
                  <select value={newBar.unit} onChange={e=>setNewBar(p=>({...p,unit:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                    {["bottle","peg","glass","pint","can","unit"].map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Price (₹)</label>
                  <input type="number" min={0} value={newBar.price} onChange={e=>setNewBar(p=>({...p,price:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"/>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Stock</label>
                  <input type="number" min={0} value={newBar.stock} onChange={e=>setNewBar(p=>({...p,stock:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"/>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Min stock (alert)</label>
                  <input type="number" min={0} value={newBar.minStock} onChange={e=>setNewBar(p=>({...p,minStock:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"/>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={()=>setShowAddBar(false)} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted text-sm font-semibold">Cancel</button>
                <button onClick={saveNewBarItem} disabled={savingBar||!newBar.name.trim()} className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40">{savingBar?"Saving…":"Add product"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBook&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Book Spa Service</h2>
              <button onClick={()=>setShowBook(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Guest Name",key:"guest",placeholder:"Full name"},
                {label:"Room Number",key:"room",placeholder:"e.g. 205 or Walk-in"},
                {label:"Preferred Time",key:"time",type:"time"},
              ].map(f=>(
                <div key={f.key}><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input type={f.type||"text"} value={(newBook as any)[f.key]} onChange={e=>setNewBook(p=>({...p,[f.key]:e.target.value}))} placeholder={(f as any).placeholder||""} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                </div>
              ))}
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Service</label>
                <select value={newBook.serviceId} onChange={e=>setNewBook(p=>({...p,serviceId:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                  {packages.filter(p=>p.available).map(p=><option key={p.id} value={p.id}>{p.name} — ₹{p.price} ({p.duration})</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Therapist</label>
                <select value={newBook.therapist} onChange={e=>setNewBook(p=>({...p,therapist:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                  {therapists.map(t=><option key={t.name} value={t.name}>{t.name} — {t.specialization} {t.status==="busy"?`(Busy until ${t.busyUntil})`:""}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Special Notes</label>
                <textarea value={newBook.notes} onChange={e=>setNewBook(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Allergies, preferences..." className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-muted-foreground"/>
              </div>
              {FEATURES.hotelReception && (
                <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Discount ₹ (in-house guest)</label>
                  <input type="number" value={newBook.discount} onChange={e=>setNewBook(p=>({...p,discount:e.target.value}))} placeholder="0" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                  <p className="text-2xs text-muted-foreground mt-1">Room number bharoge to bill us room ke folio me add ho jayega.</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={()=>setShowBook(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={async ()=>{
                  const svc = packages.find(p=>p.id===newBook.serviceId);
                  if(!newBook.guest || !restaurantId) return;
                  // Build a full datetime from the time input (today + HH:MM); default to now.
                  const scheduledAt = (() => {
                    if (!newBook.time) return new Date().toISOString();
                    const [h, m] = newBook.time.split(":");
                    const d = new Date(); d.setHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
                    return d.toISOString();
                  })();
                  const room = FEATURES.hotelReception && newBook.room && !/walk/i.test(newBook.room) ? newBook.room.trim() : undefined;
                  try {
                    await spaApi.createBooking(restaurantId, {
                      serviceId: newBook.serviceId ? Number(newBook.serviceId) : undefined,
                      serviceName: svc?.name || "Spa Service",
                      guestName: newBook.guest, therapist: newBook.therapist,
                      scheduledAt, duration: 60, price: svc?.price || 0, notes: newBook.notes,
                      ...(room ? { roomNumber: room, discount: Number(newBook.discount) || 0 } : {}),
                    });
                    const refreshed = await spaApi.bookings(restaurantId);
                    setBookings((Array.isArray(refreshed) ? refreshed : []).map((b: any) => ({
                      id: String(b.id), guest: b.guestName || "—", room: b.roomNumber || b.metadata?.roomNumber || "—",
                      service: b.serviceName || "—", therapist: b.therapist || "—",
                      time: b.scheduledAt ? new Date(b.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
                      status: b.status || "pending",
                      amount: parseFloat(String(b.price ?? 0)), date: todayLabel, notes: b.notes || "",
                    })));
                    setNewBook({guest:"",room:"",serviceId:packages[0]?.id || "",therapist:therapists[0]?.name || "",time:"",notes:"",discount:""});
                    setShowBook(false);
                  } catch (e) { console.error(e); }
                }} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm">Book Now</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full guest / booking detail */}
      {detailBooking && (() => {
        const b = detailBooking;
        const pay = b.payment;
        const paid = b.paymentStatus === "paid";
        const rows: [string, string][] = [
          ["Guest", b.guest || "—"],
          ["Mobile", b.phone || "—"],
          ["Email", b.email || "—"],
          ["Service", b.service || "—"],
          ["Room", b.room || "—"],
          ["Therapist", b.therapist || "—"],
          ["Date", b.scheduledAt ? new Date(b.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : b.date || "—"],
          ["Time", b.time || "—"],
          ["Duration", b.duration ? `${b.duration} min` : "—"],
          ["Type", b.bookingType || "single"],
          ["Amount", b.amount > 0 ? `₹${b.amount.toLocaleString("en-IN")}` : "—"],
          ["Status", b.status || "—"],
          ["Payment", paid ? `Paid${pay?.method ? ` · ${String(pay.method).toUpperCase()}` : ""}` : "Pending"],
        ];
        if (paid && pay) {
          if (pay.upiId) rows.push(["UPI ID", pay.upiId]);
          if (pay.utr || pay.reference) rows.push(["UTR / Ref", pay.utr || pay.reference || "—"]);
          if (pay.collectedBy) rows.push(["Collected by", pay.collectedBy]);
        }
        if (b.notes) rows.push(["Notes", b.notes]);
        return (
          <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailBooking(null)}>
            <div className="w-full max-w-md bg-card rounded-lg border border-border text-foreground max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base truncate flex items-center gap-2"><Leaf className="h-4 w-4 text-success" />{b.guest}</h3>
                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${b.status === "completed" ? "bg-success-subtle text-success" : b.status === "confirmed" ? "bg-success-subtle text-success" : b.status === "cancelled" ? "bg-danger-subtle text-danger" : "bg-warning-subtle text-warning"}`}>{b.status}</span>
                    {paid && <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-success-subtle text-success">PAID</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.service}</p>
                </div>
                <button onClick={() => setDetailBooking(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-2xs text-muted-foreground">{k}</p>
                      <p className="text-sm font-medium break-all capitalize">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-5" onClick={e => e.stopPropagation()}>
                  {b.status === "pending" && <button onClick={() => { updateBooking(b.id, "confirmed"); setDetailBooking(null); }} className="flex-1 py-2.5 rounded-lg bg-success-subtle text-success text-sm font-semibold hover-elevate">Confirm</button>}
                  {b.status === "confirmed" && <button onClick={() => { updateBooking(b.id, "completed"); setDetailBooking(null); }} className="flex-1 py-2.5 rounded-lg bg-success-subtle text-success text-sm font-semibold hover-elevate flex items-center justify-center gap-1"><CheckCircle className="h-4 w-4" /> Mark Done</button>}
                  <button onClick={() => setDetailBooking(null)} className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground text-sm font-semibold hover:bg-muted">Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
