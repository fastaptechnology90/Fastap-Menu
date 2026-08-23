import { useState, useEffect } from "react";
import { Leaf, Wine, Calendar, Clock, Users, Plus, X, CheckCircle, Star, Package, Droplets, FlaskConical, Scissors, Dumbbell } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { spa as spaApi, barApi, staff as staffApi, roomService as roomServiceApi } from "@/lib/api";
import { FEATURES } from "@/lib/featureFlags";
import { ModulePackages } from "@/components/restaurant/ModulePackages";

type SpaBooking = {
  id: string; guest: string; room: string; service: string; therapist: string;
  time: string; status: string; amount: number; date: string; notes: string;
};
type SpaPackage = {
  id: string; name: string; duration: string; price: number; category: string;
  includes: string[]; therapists: string[]; available: boolean;
};
type BarItem = { id: string; name: string; category: string; price: number; stock: number; minStock: number; unit: string };
type CocktailRecipe = { name: string; ingredients: string[]; glass: string; garnish: string; prep: string };
type Therapist = { name: string; specialization: string; status: string; busyUntil?: string; bookingsToday: number };

const CATEGORY_CFG: Record<string,{label:string;icon:any;color:string}> = {
  massage:  {label:"Massage",   icon:Leaf,        color:"text-emerald-400"},
  couple:   {label:"Couples",   icon:Users,       color:"text-pink-400"},
  beauty:   {label:"Beauty",    icon:Scissors,    color:"text-violet-400"},
  wellness: {label:"Wellness",  icon:Dumbbell,    color:"text-blue-400"},
  spirits:  {label:"Spirits",   icon:FlaskConical,color:"text-amber-400"},
  beer:     {label:"Beer",      icon:Wine,        color:"text-yellow-400"},
  wine:     {label:"Wine",      icon:Wine,        color:"text-rose-400"},
  cocktail: {label:"Cocktails", icon:Droplets,    color:"text-cyan-400"},
  mocktail: {label:"Mocktails", icon:Droplets,    color:"text-green-400"},
};

type Tab = "spa-bookings"|"spa-packages"|"bar-orders"|"bar-inventory"|"recipes";

export default function SpaBar() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("spa-bookings");
  const [bookings, setBookings] = useState<SpaBooking[]>([]);
  const [packages, setPackages] = useState<SpaPackage[]>([]);
  const [barItems, setBarItems] = useState<BarItem[]>([]);
  const [cocktailRecipes, setCocktailRecipes] = useState<CocktailRecipe[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
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

  const lowStock = barItems.filter(i=>i.stock<i.minStock);
  const filteredBar = catFilter==="all" ? barItems : barItems.filter(i=>i.category===catFilter);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Spa & Bar</h1>
          <p className="text-xs text-white/40">Wellness services and beverage management</p>
        </div>
        {(tab==="spa-bookings"||tab==="spa-packages")&&(
          <button onClick={()=>setShowBook(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
            <Plus className="h-4 w-4"/>Book Spa
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Today's Bookings",value:spaToday,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Spa Revenue",value:`₹${(spaRevenue/1000).toFixed(1)}K`,color:"text-amber-400",bg:"bg-amber-500/10"},
          {label:"Pending Sessions",value:spaPending,color:"text-yellow-400",bg:"bg-yellow-500/10"},
          {label:"Bar Alerts",value:lowStock.length,color:"text-red-400",bg:"bg-red-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <ModulePackages restaurantId={restaurantId} module="spa" title="Spa & Bar Packages / Plans" label="Plan" />

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar">
        {([["spa-bookings","Spa Bookings"],["spa-packages","Packages & Therapists"],["bar-orders","Bar Orders"],["bar-inventory","Bar Inventory"],["recipes","Cocktail Recipes"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="spa-bookings"&&(
        <div className="space-y-3">
          {bookings.length === 0 && (
            <div className="text-center py-12 text-white/40 text-sm">No spa bookings yet. Create services and accept bookings from guests.</div>
          )}
          {bookings.map(b=>(
            <div key={b.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0"><Leaf className="h-5 w-5 text-emerald-400"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-bold">{b.guest}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.status==="confirmed"?"bg-emerald-500/20 text-emerald-400":b.status==="completed"?"bg-teal-500/20 text-teal-400":"bg-yellow-500/20 text-yellow-400"}`}>{b.status}</span>
                    {b.amount>0&&<span className="text-xs text-amber-400 font-bold">₹{b.amount}</span>}
                  </div>
                  <p className="text-sm text-white/70">{b.service}</p>
                  <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{b.time}</span>
                    <span>Room: {b.room}</span>
                    <span>Therapist: {b.therapist}</span>
                  </div>
                  {b.notes&&<p className="text-xs text-yellow-300/70 mt-1">⚠️ {b.notes}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {b.status==="pending"&&<button onClick={()=>updateBooking(b.id,"confirmed")} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30">Confirm</button>}
                  {b.status==="confirmed"&&<button onClick={()=>updateBooking(b.id,"completed")} className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-400 text-xs font-semibold hover:bg-teal-500/30 flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Done</button>}
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
            <h3 className="text-sm font-bold text-white/70 mb-3">Therapist Status</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {therapists.length === 0 && (
                <p className="text-sm text-white/40 col-span-full">Add spa staff in Staff Management to see therapist availability.</p>
              )}
              {therapists.map(t=>(
                <div key={t.name} className={`rounded-xl border p-3 ${t.status==="available"?"border-emerald-500/20 bg-emerald-500/5":"border-orange-500/20 bg-orange-500/5"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${t.status==="available"?"bg-emerald-400":"bg-orange-400"}`}/>
                    <p className="text-sm font-bold">{t.name}</p>
                  </div>
                  <p className="text-xs text-white/40">{t.specialization}</p>
                  <p className={`text-xs mt-1 font-semibold ${t.status==="available"?"text-emerald-400":"text-orange-400"}`}>
                    {t.status==="available"?"Available":t.busyUntil?`Busy until ${t.busyUntil}`:"Busy"}
                  </p>
                  <p className="text-xs text-white/30">{t.bookingsToday} bookings today</p>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {["all","massage","couple","beauty","wellness"].map(c=>(
              <button key={c} onClick={()=>setCatFilter(c)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${catFilter===c?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{c==="all"?"All Services":c}</button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {packages.filter(p=>catFilter==="all"||p.category===catFilter).map(p=>{
              const cfg = CATEGORY_CFG[p.category]||CATEGORY_CFG.wellness;
              return (
                <div key={p.id} className={`bg-[#0e1520] border rounded-2xl p-4 ${p.available?"border-white/5":"border-red-500/15 opacity-60"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold">{p.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{p.duration}</span>
                        <span className={`capitalize px-1.5 py-0.5 rounded-md bg-white/10 ${cfg.color}`}>{p.category}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-amber-400">₹{p.price.toLocaleString()}</p>
                      {!p.available&&<span className="text-xs text-red-400">Not available</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.includes.map(inc=><span key={inc} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/50">✓ {inc}</span>)}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/30">Therapists: {p.therapists.join(", ")}</p>
                    {p.available&&<button onClick={()=>setShowBook(true)} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30">Book Now</button>}
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
              <button key={c} onClick={()=>setCatFilter(c)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${catFilter===c?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{c==="all"?"All Categories":c}</button>
            ))}
          </div>
          {FEATURES.hotelReception && (
            <div className="bg-[#0e1520] border border-amber-500/20 rounded-2xl p-4">
              <p className="text-sm font-bold mb-1 flex items-center gap-2"><Wine className="h-4 w-4 text-amber-400"/>Charge to Room</p>
              <p className="text-xs text-white/30 mb-3">Neeche items pe click karke cart me daalo, room number bharo, phir Charge — bill us room ke folio me chala jayega.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input value={barRoom} onChange={e=>setBarRoom(e.target.value)} placeholder="Room No." className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                <div className="flex-1 min-w-0 text-xs text-white/50 truncate">{barCart.length ? barCart.map(c=>`${c.qty}x ${c.name}`).join(", ") : "No items yet — tap items below"}</div>
                <span className="text-sm font-bold text-amber-400">₹{barCartTotal}</span>
                {barCart.length>0 && <button onClick={()=>setBarCart([])} className="text-xs text-white/40 hover:text-white px-2">Clear</button>}
                <button onClick={chargeBarToRoom} disabled={!barRoom.trim()||barCart.length===0||chargingBar} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-40">{chargingBar?"…":"Charge"}</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredBar.map(item=>{
              const cfg = CATEGORY_CFG[item.category]||CATEGORY_CFG.cocktail;
              return (
                <button key={item.id} onClick={FEATURES.hotelReception ? ()=>addBarItem(item) : undefined} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 text-left hover:border-white/10 transition-all">
                  <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center mb-3 ${cfg.color}`}><cfg.icon className="h-5 w-5"/></div>
                  <p className="text-sm font-bold">{item.name}</p>
                  <p className="text-xs text-amber-400 font-extrabold mt-0.5">₹{item.price}</p>
                  <p className={`text-xs mt-1 ${item.stock<item.minStock?"text-red-400":"text-white/30"}`}>{item.stock<999?`Stock: ${item.stock} ${item.unit}${item.stock<item.minStock?" ⚠️":""}`:item.category}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab==="bar-inventory"&&(
        <div className="space-y-4">
          {lowStock.length>0&&(
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm font-bold text-red-400 mb-2">⚠️ Low Stock Alerts ({lowStock.length} items)</p>
              <div className="flex flex-wrap gap-2">
                {lowStock.map(i=><span key={i.id} className="text-xs bg-red-500/20 text-red-300 px-2.5 py-1 rounded-full">{i.name} — {i.stock} left</span>)}
              </div>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/30 border-b border-white/5">
                {["Item","Category","Price","Stock","Min Stock","Status"].map(h=><th key={h} className="pb-3 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {barItems.filter(i=>i.stock<999).map(item=>{
                const isLow = item.stock<item.minStock;
                return (
                  <tr key={item.id} className={`hover:bg-white/3 transition-all ${isLow?"bg-red-500/3":""}`}>
                    <td className="py-3 pr-4 font-semibold">{item.name}</td>
                    <td className="py-3 pr-4 capitalize text-white/50">{item.category}</td>
                    <td className="py-3 pr-4 text-amber-400">₹{item.price}</td>
                    <td className="py-3 pr-4 font-bold">{item.stock} <span className="text-white/30 font-normal">{item.unit}</span></td>
                    <td className="py-3 pr-4 text-white/40">{item.minStock}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isLow?"bg-red-500/20 text-red-400":"bg-emerald-500/20 text-emerald-400"}`}>{isLow?"Low Stock":"OK"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab==="recipes"&&(
        <div className="grid lg:grid-cols-3 gap-4">
          {cocktailRecipes.map(recipe=>(
            <div key={recipe.name} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5 hover:border-amber-500/20 cursor-pointer transition-all" onClick={()=>setSelectedRecipe(selectedRecipe?.name===recipe.name?null:recipe)}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{recipe.name}</h3>
                  <p className="text-xs text-white/40 mt-0.5">Glass: {recipe.glass}</p>
                </div>
                <Wine className="h-5 w-5 text-amber-400"/>
              </div>
              <p className="text-xs text-white/50 mb-3">Garnish: {recipe.garnish}</p>
              <div className="flex flex-wrap gap-1">
                {recipe.ingredients.slice(0,3).map(i=><span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/40">{i}</span>)}
                {recipe.ingredients.length>3&&<span className="text-xs text-white/30">+{recipe.ingredients.length-3} more</span>}
              </div>
              {selectedRecipe?.name===recipe.name&&(
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wide">All Ingredients</p>
                    <div className="space-y-1">
                      {recipe.ingredients.map(i=><p key={i} className="text-xs text-white/70">• {i}</p>)}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wide">Preparation</p>
                    <p className="text-xs text-white/70 leading-relaxed">{recipe.prep}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Spa Booking Modal */}
      {showBook&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Book Spa Service</h2>
              <button onClick={()=>setShowBook(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Guest Name",key:"guest",placeholder:"Full name"},
                {label:"Room Number",key:"room",placeholder:"e.g. 205 or Walk-in"},
                {label:"Preferred Time",key:"time",type:"time"},
              ].map(f=>(
                <div key={f.key}><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input type={f.type||"text"} value={(newBook as any)[f.key]} onChange={e=>setNewBook(p=>({...p,[f.key]:e.target.value}))} placeholder={(f as any).placeholder||""} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                </div>
              ))}
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Service</label>
                <select value={newBook.serviceId} onChange={e=>setNewBook(p=>({...p,serviceId:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white">
                  {packages.filter(p=>p.available).map(p=><option key={p.id} value={p.id}>{p.name} — ₹{p.price} ({p.duration})</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Therapist</label>
                <select value={newBook.therapist} onChange={e=>setNewBook(p=>({...p,therapist:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white">
                  {therapists.map(t=><option key={t.name} value={t.name}>{t.name} — {t.specialization} {t.status==="busy"?`(Busy until ${t.busyUntil})`:""}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Special Notes</label>
                <textarea value={newBook.notes} onChange={e=>setNewBook(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Allergies, preferences..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-white/20"/>
              </div>
              {FEATURES.hotelReception && (
                <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Discount ₹ (in-house guest)</label>
                  <input type="number" value={newBook.discount} onChange={e=>setNewBook(p=>({...p,discount:e.target.value}))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                  <p className="text-[11px] text-white/30 mt-1">Room number bharoge to bill us room ke folio me add ho jayega.</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={()=>setShowBook(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
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
                }} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Book Now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
