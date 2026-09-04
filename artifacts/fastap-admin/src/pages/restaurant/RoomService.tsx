import { useState, useEffect, useCallback } from "react";
import { BedDouble, Coffee, Shirt, Wrench, LogOut, Bell, Clock, CheckCircle, Plus, X, ShoppingCart, Package, CreditCard, UserPlus, Pencil } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { roomService as roomServiceApi, platformApi, menu as menuApi } from "@/lib/api";
import { FEATURES } from "@/lib/featureFlags";

const ROOM_TYPES = ["standard", "deluxe", "premium", "suite"];
const ROOM_STATUSES = ["vacant", "occupied", "cleaning", "maintenance", "reserved"];
const emptyCheckin = { number: "", type: "standard", floor: "1", status: "occupied", guestName: "", guestPhone: "", checkIn: "", checkOut: "", rate: "", discount: "", guestCount: "1" };

function isoToDateInput(v: string | Date | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

type RoomRequest = {
  id: string;
  room: string;
  guestName: string;
  type: string;
  item: string;
  time: string;
  status: string;
  priority: string;
  charge: number;
  assignedTo: string;
  guestPhone?: string;
  notes?: string;
  paymentMethod?: string;
  items?: { name?: string; description?: string; quantity?: number; qty?: number; price?: number }[];
  createdAt?: string;
};

type Room = {
  number: string;
  guest: string | null;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  type: string;
  floor: number;
  pending: number;
};

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtTime(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fromApiStatus(status: string, type?: string) {
  if (status === "accepted") return type === "food" ? "preparing" : "in-progress";
  if (status === "in_progress") return "in-progress";
  if (status === "completed" && type === "minibar") return "delivered";
  return status;
}

function toApiStatus(status: string) {
  if (status === "preparing" || status === "in-progress") return "in_progress";
  if (status === "delivered") return "completed";
  return status;
}

function mapRequest(r: any): RoomRequest {
  const items = Array.isArray(r.items) ? r.items : [];
  const itemText = r.notes || items.map((i: any) => i.name || i.description || String(i)).join(", ") || "—";
  return {
    id: String(r.id),
    room: r.roomNumber,
    guestName: r.guestName || "Guest",
    type: r.type || "food",
    item: itemText,
    time: fmtTime(r.createdAt),
    status: fromApiStatus(r.status, r.type),
    priority: "normal",
    charge: parseFloat(String(r.total)) || 0,
    assignedTo: r.assignedTo || "Auto-assigning…",
    guestPhone: r.guestPhone || "",
    notes: r.notes || "",
    paymentMethod: r.paymentMethod || "",
    items,
    createdAt: r.createdAt || "",
  };
}

function mapRoom(r: any, pendingCounts: Record<string, number>): Room {
  return {
    number: r.number,
    guest: r.guestName || null,
    status: r.status || "vacant",
    checkIn: fmtDate(r.checkIn),
    checkOut: fmtDate(r.checkOut),
    type: (r.type || "standard").replace(/^\w/, (c: string) => c.toUpperCase()),
    floor: r.floor ?? 1,
    pending: pendingCounts[r.number] || 0,
  };
}

type MinibarItem = { id: string; name: string; price: number; category: string };

const TYPE_CFG: Record<string,{label:string;icon:any;color:string;bg:string}> = {
  food:         {label:"Food Order",   icon:Coffee,     color:"text-amber-400",  bg:"bg-amber-500/15"},
  housekeeping: {label:"Housekeeping", icon:BedDouble,  color:"text-blue-400",   bg:"bg-blue-500/15"},
  laundry:      {label:"Laundry",      icon:Shirt,      color:"text-violet-400", bg:"bg-violet-500/15"},
  maintenance:  {label:"Maintenance",  icon:Wrench,     color:"text-orange-400", bg:"bg-orange-500/15"},
  checkout:     {label:"Checkout",     icon:LogOut,     color:"text-red-400",    bg:"bg-red-500/15"},
  minibar:      {label:"Mini Bar",     icon:Package,    color:"text-pink-400",   bg:"bg-pink-500/15"},
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  pending:     {label:"Pending",     color:"text-yellow-400", bg:"bg-yellow-500/15"},
  preparing:   {label:"Preparing",   color:"text-blue-400",   bg:"bg-blue-500/15"},
  "in-progress":{label:"In Progress",color:"text-orange-400", bg:"bg-orange-500/15"},
  completed:   {label:"Completed",   color:"text-emerald-400",bg:"bg-emerald-500/15"},
  delivered:   {label:"Delivered",   color:"text-teal-400",   bg:"bg-teal-500/15"},
};

const ROOM_STATUS: Record<string,{label:string;color:string;bg:string}> = {
  occupied:    {label:"Occupied",    color:"text-emerald-400",bg:"bg-emerald-500/20"},
  vacant:      {label:"Vacant",      color:"text-white/50",   bg:"bg-white/5"},
  cleaning:    {label:"Cleaning",    color:"text-blue-400",   bg:"bg-blue-500/20"},
  maintenance: {label:"Maintenance", color:"text-orange-400", bg:"bg-orange-500/20"},
  reserved:    {label:"Reserved",    color:"text-violet-400", bg:"bg-violet-500/20"},
};

type Tab = "requests"|"rooms"|"new-request"|"minibar-pos"|"food-pos";

type MenuItem = { id: number; name: string; price: number; categoryId: number; isAvailable: boolean };

export default function RoomService() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [detailReq, setDetailReq] = useState<RoomRequest | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [requestType, setRequestType] = useState<keyof typeof TYPE_CFG>("food");
  const [requestNote, setRequestNote] = useState("");
  const [requestPriority, setRequestPriority] = useState("normal");
  const [cart, setCart] = useState<{item: MinibarItem; qty: number}[]>([]);
  const [minibar, setMinibar] = useState<MinibarItem[]>([]);
  const [posRoom, setPosRoom] = useState("");
  // Food ordering (reception can place a food order for a room — charged to the room bill)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCats, setMenuCats] = useState<{ id: number; name: string }[]>([]);
  const [foodCart, setFoodCart] = useState<{item: MenuItem; qty: number}[]>([]);
  const [foodRoom, setFoodRoom] = useState("");
  const [foodCatFilter, setFoodCatFilter] = useState<number | "all">("all");
  const [foodSearch, setFoodSearch] = useState("");
  const [sendingFood, setSendingFood] = useState(false);
  // Reception check-in (WIP — gated behind FEATURES.hotelReception; hidden on prod)
  const [apiRooms, setApiRooms] = useState<any[]>([]);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [checkinForm, setCheckinForm] = useState({ ...emptyCheckin });
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [folioRoom, setFolioRoom] = useState<string | null>(null);
  const [folioData, setFolioData] = useState<any | null>(null);
  const [folioLoading, setFolioLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [otaBusy, setOtaBusy] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
    try {
      const [reqData, roomData, minibarData, itemsData, catsData] = await Promise.all([
        roomServiceApi.requests(restaurantId),
        roomServiceApi.rooms(restaurantId),
        roomServiceApi.minibar(restaurantId).catch(() => []),
        menuApi.items(restaurantId).catch(() => []),
        menuApi.categories(restaurantId).catch(() => []),
      ]);
      setMenuItems((Array.isArray(itemsData) ? itemsData : []).map((i: any) => ({
        id: i.id, name: i.name, price: parseFloat(String(i.price)) || 0,
        categoryId: i.categoryId, isAvailable: i.isAvailable !== false,
      })));
      setMenuCats((Array.isArray(catsData) ? catsData : []).map((c: any) => ({ id: c.id, name: c.name })));
      const mappedReqs = (Array.isArray(reqData) ? reqData : []).map(mapRequest);
      const pendingCounts: Record<string, number> = {};
      mappedReqs.forEach(r => {
        if (["pending", "preparing", "in-progress"].includes(r.status)) {
          pendingCounts[r.room] = (pendingCounts[r.room] || 0) + 1;
        }
      });
      setRequests(mappedReqs);
      setApiRooms(Array.isArray(roomData) ? roomData : []);
      setRooms((Array.isArray(roomData) ? roomData : []).map(r => mapRoom(r, pendingCounts)));
      setMinibar(Array.isArray(minibarData) ? minibarData : []);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, [restaurantId]);

  // Guest room requests arrive while this page is open. Without a poll they
  // stayed invisible until someone reloaded the page.
  useEffect(() => {
    loadData();
    const t = setInterval(() => loadData(true), 15000);
    return () => clearInterval(t);
  }, [loadData]);

  const filtered = requests.filter(r => typeFilter==="all" || r.type===typeFilter);
  const pending = requests.filter(r=>["pending","preparing","in-progress"].includes(r.status)).length;
  const activeRooms = rooms.filter(r=>r.status==="occupied");

  async function updateStatus(id: string, status: string) {
    if (!restaurantId) return;
    try {
      await roomServiceApi.updateRequest(restaurantId, Number(id), { status: toApiStatus(status) });
      setRequests(r => r.map(req => req.id === id ? { ...req, status } : req));
    } catch (e) { console.error(e); }
  }

  async function addRequest() {
    if (!selectedRoom || !requestNote || !restaurantId) return;
    const room = rooms.find(r => r.number === selectedRoom);
    try {
      const created = await roomServiceApi.createRequest(restaurantId, {
        roomNumber: selectedRoom,
        guestName: room?.guest || "Guest",
        type: requestType,
        notes: requestNote,
        total: 0,
        items: [],
      });
      setRequests(r => [mapRequest(created), ...r]);
      setSelectedRoom(""); setRequestNote(""); setShowNew(false);
    } catch (e) { console.error(e); }
  }

  function openCheckinNew() {
    setEditingRoomId(null);
    setCheckinForm({ ...emptyCheckin });
    setCheckinOpen(true);
  }

  function openCheckinEdit(roomNumber: string) {
    const raw = apiRooms.find(r => r.number === roomNumber);
    if (!raw) return;
    const billing = (raw.roomControls?.billing ?? {}) as { rate?: number; discount?: number; guestCount?: number };
    setEditingRoomId(raw.id);
    setCheckinForm({
      number: raw.number ?? "",
      type: raw.type || "standard",
      floor: String(raw.floor ?? 1),
      status: raw.status || "occupied",
      guestName: raw.guestName || "",
      guestPhone: raw.guestPhone || "",
      checkIn: isoToDateInput(raw.checkIn),
      checkOut: isoToDateInput(raw.checkOut),
      rate: billing.rate ? String(billing.rate) : "",
      discount: billing.discount ? String(billing.discount) : "",
      guestCount: billing.guestCount ? String(billing.guestCount) : "1",
    });
    setCheckinOpen(true);
  }

  async function saveCheckin() {
    if (!restaurantId || !checkinForm.number.trim() || savingCheckin) return;
    setSavingCheckin(true);
    const body = {
      number: checkinForm.number.trim(),
      type: checkinForm.type,
      floor: parseInt(checkinForm.floor, 10) || 1,
      status: checkinForm.status,
      guestName: checkinForm.guestName.trim() || null,
      guestPhone: checkinForm.guestPhone.trim() || null,
      checkIn: checkinForm.checkIn || null,
      checkOut: checkinForm.checkOut || null,
      rate: checkinForm.rate === "" ? undefined : Number(checkinForm.rate) || 0,
      discount: checkinForm.discount === "" ? undefined : Number(checkinForm.discount) || 0,
      guestCount: checkinForm.guestCount === "" ? undefined : parseInt(checkinForm.guestCount, 10) || 1,
    };
    try {
      if (editingRoomId) await roomServiceApi.updateRoom(restaurantId, editingRoomId, body);
      else await roomServiceApi.createRoom(restaurantId, body);
      setCheckinOpen(false);
      setEditingRoomId(null);
      await loadData();
    } catch (e) { console.error(e); }
    finally { setSavingCheckin(false); }
  }

  async function openFolio(roomNumber: string) {
    if (!restaurantId) return;
    setFolioRoom(roomNumber); setFolioData(null); setFolioLoading(true);
    try { setFolioData(await roomServiceApi.folio(restaurantId, roomNumber)); }
    catch (e) { console.error(e); }
    finally { setFolioLoading(false); }
  }

  async function doCheckout() {
    if (!restaurantId || !folioRoom || checkingOut) return;
    if (!confirm(`Check-out Room ${folioRoom}? The bill will be settled and the room freed.`)) return;
    setCheckingOut(true);
    try {
      await roomServiceApi.checkout(restaurantId, folioRoom);
      setFolioRoom(null); setFolioData(null);
      await loadData();
    } catch (e) { console.error(e); }
    finally { setCheckingOut(false); }
  }

  // WIP: simulate an OTA (MakeMyTrip/OYO) online booking → auto-allot a vacant room.
  async function simulateOtaBooking() {
    if (!restaurantId || otaBusy) return;
    setOtaBusy(true);
    try {
      const res = await platformApi.ingestOtaBooking(restaurantId, "makemytrip", {
        guestName: "MakeMyTrip Guest", roomType: "deluxe",
        checkIn: new Date().toISOString(),
        checkOut: new Date(Date.now() + 86400000).toISOString(),
        rate: 3500,
      });
      alert(`✅ MakeMyTrip booking auto-allotted to Room ${res?.allottedRoom ?? "?"}.`);
      await loadData();
    } catch { alert("OTA ingest failed — no vacant room found or server error."); }
    finally { setOtaBusy(false); }
  }

  const cartTotal = cart.reduce((s,c)=>s+c.item.price*c.qty,0);

  function addToCart(item: MinibarItem) {
    setCart(c=>{
      const ex = c.find(x=>x.item.id===item.id);
      if (ex) return c.map(x=>x.item.id===item.id?{...x,qty:x.qty+1}:x);
      return [...c,{item,qty:1}];
    });
  }

  async function chargeMinbar() {
    if (!posRoom || cartTotal===0 || !restaurantId) return;
    const items = cart.map(c => ({ name: c.item.name, qty: c.qty, price: c.item.price }));
    const room = rooms.find(r => r.number === posRoom);
    try {
      const created = await roomServiceApi.createRequest(restaurantId, {
        roomNumber: posRoom,
        guestName: room?.guest || "Guest",
        type: "minibar",
        notes: cart.map(c => `${c.qty}× ${c.item.name}`).join(", "),
        total: cartTotal,
        items,
        paymentMethod: "room_bill",
      });
      await roomServiceApi.updateRequest(restaurantId, created.id, { status: "completed" });
      setRequests(r => [mapRequest({ ...created, status: "completed", total: cartTotal }), ...r]);
      setCart([]); setPosRoom("");
    } catch (e) { console.error(e); }
  }

  // ── Food ordering (reception → room bill) ───────────────────────────
  const foodCartTotal = foodCart.reduce((s, c) => s + c.item.price * c.qty, 0);
  const catName = (id: number) => menuCats.find(c => c.id === id)?.name || "Menu";
  const availableMenu = menuItems.filter(i =>
    i.isAvailable &&
    (foodCatFilter === "all" || i.categoryId === foodCatFilter) &&
    (!foodSearch || i.name.toLowerCase().includes(foodSearch.toLowerCase())),
  );
  // Only show categories that actually have available items, for the filter bar.
  const foodCatsWithItems = menuCats.filter(c => menuItems.some(i => i.isAvailable && i.categoryId === c.id));

  function addToFoodCart(item: MenuItem) {
    setFoodCart(c => {
      const ex = c.find(x => x.item.id === item.id);
      if (ex) return c.map(x => x.item.id === item.id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { item, qty: 1 }];
    });
  }

  async function sendFoodOrder() {
    if (!foodRoom || foodCartTotal === 0 || !restaurantId || sendingFood) return;
    setSendingFood(true);
    const items = foodCart.map(c => ({ name: c.item.name, qty: c.qty, price: c.item.price }));
    const room = rooms.find(r => r.number === foodRoom);
    try {
      const created = await roomServiceApi.createRequest(restaurantId, {
        roomNumber: foodRoom,
        guestName: room?.guest || "Guest",
        type: "food",
        notes: foodCart.map(c => `${c.qty}× ${c.item.name}`).join(", "),
        total: foodCartTotal,
        items,
        paymentMethod: "room_bill",
      });
      // Food goes to the kitchen — leave it pending so staff can Accept → prepare → Done.
      setRequests(r => [mapRequest(created), ...r]);
      setFoodCart([]); setFoodRoom("");
      setTab("requests");
    } catch (e) { console.error(e); }
    finally { setSendingFood(false); }
  }

  if (loading && requests.length === 0 && rooms.length === 0) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading room service data…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Room Service</h1>
          <p className="text-xs text-white/40">Guest requests auto-assign to staff — room no. + assignee shown below</p>
        </div>
        <div className="flex items-center gap-2">
          {pending>0&&<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/15 text-orange-400 text-xs font-semibold"><Bell className="h-3 w-3"/>{pending} pending</div>}
          <button onClick={()=>setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
            <Plus className="h-4 w-4"/>New Request
          </button>
        </div>
      </div>

      {/* Type Summary */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.entries(TYPE_CFG).map(([key,cfg])=>{
          const count = requests.filter(r=>r.type===key&&["pending","preparing","in-progress"].includes(r.status)).length;
          return (
            <button key={key} onClick={()=>setTypeFilter(typeFilter===key?"all":key)} className={`p-3 rounded-xl border transition-all ${typeFilter===key?`${cfg.bg} border-white/20`:"bg-white/3 border-white/5 hover:bg-white/5"}`}>
              <cfg.icon className={`h-5 w-5 ${cfg.color} mb-1`}/>
              <p className={`text-lg font-extrabold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-white/40">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["requests","Service Requests"],["rooms","Room Status"],["food-pos","Food Order"],["minibar-pos","Mini-Bar POS"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="requests"&&(
        <div className="space-y-3">
          {filtered.length===0&&<div className="text-center py-12 text-white/30"><Coffee className="h-12 w-12 mx-auto mb-3"/><p>No requests</p></div>}
          {filtered.map(req=>{
            const tcfg = TYPE_CFG[req.type] || TYPE_CFG.food;
            const scfg = STATUS_CFG[req.status] || STATUS_CFG.pending;
            return (
              <div key={req.id} onClick={()=>setDetailReq(req)} title="Click for full details" className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 cursor-pointer hover:border-amber-500/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl ${tcfg.bg} flex items-center justify-center ${tcfg.color} shrink-0`}><tcfg.icon className="h-5 w-5"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">Room {req.room}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      {req.priority==="high"&&<span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">URGENT</span>}
                      {req.charge>0&&<span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400">₹{req.charge}</span>}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{req.guestName} · {tcfg.label}</p>
                    <p className="text-sm text-white/80 mt-1">{req.item}</p>
                    <p className="text-xs text-emerald-400/90 mt-1">Staff: {req.assignedTo}</p>
                    <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3"/>{req.time}</p>
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={e=>e.stopPropagation()}>
                    {req.status==="pending"&&(
                      <button onClick={()=>updateStatus(req.id,req.type==="food"?"preparing":"in-progress")} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30">Accept</button>
                    )}
                    {(req.status==="preparing"||req.status==="in-progress")&&(
                      <button onClick={()=>updateStatus(req.id,"completed")} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Done</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="rooms"&&(
        <div>
          {FEATURES.hotelReception && (
            <div className="flex items-center justify-between mb-4 gap-2">
              <p className="text-xs text-white/40">Reception — guest check-in &amp; room allotment</p>
              <div className="flex items-center gap-2">
                {FEATURES.aggregatorIngest && (
                  <button onClick={simulateOtaBooking} disabled={otaBusy} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/20 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 disabled:opacity-40">
                    {otaBusy ? "…" : "Simulate OTA Booking"}
                  </button>
                )}
                <button onClick={openCheckinNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all">
                  <UserPlus className="h-4 w-4"/>Check-in Guest
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              {label:"Occupied",value:activeRooms.length,color:"text-emerald-400"},
              {label:"Vacant",value:rooms.filter(r=>r.status==="vacant").length,color:"text-white/50"},
              {label:"Needs Attention",value:rooms.filter(r=>r.pending>0).length,color:"text-red-400"},
            ].map(s=>(
              <div key={s.label} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 text-center">
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/40">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {rooms.map(room=>{
              const cfg = ROOM_STATUS[room.status];
              return (
                <div key={room.number} onClick={FEATURES.hotelReception ? () => openCheckinEdit(room.number) : undefined} className={`${cfg.bg} border border-white/10 rounded-2xl p-3 ${FEATURES.hotelReception ? "cursor-pointer" : ""} hover:border-white/20 transition-all relative`}>
                  {FEATURES.hotelReception && <Pencil className="absolute top-2 right-2 h-3 w-3 text-white/25"/>}
                  {room.pending>0&&<div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold">{room.pending}</div>}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-extrabold">{room.number}</p>
                    <span className="text-xs text-white/30">{room.type}</span>
                  </div>
                  <p className={`text-xs font-semibold ${cfg.color} mb-1`}>{cfg.label}</p>
                  {room.guest ? (
                    <div>
                      <p className="text-xs text-white/60 truncate">{room.guest}</p>
                      <p className="text-xs text-white/30 mt-0.5">CO: {room.checkOut}</p>
                      {FEATURES.hotelReception && (
                        <button onClick={(e)=>{e.stopPropagation(); openFolio(room.number);}} className="mt-2 w-full py-1 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25">Bill</button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30">{room.status==="reserved"?`From ${room.checkIn}`:"—"}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="food-pos"&&(
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-2 block">Select Room</label>
              <select value={foodRoom} onChange={e=>setFoodRoom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white">
                <option value="">-- Select Room --</option>
                {rooms.map(r=><option key={r.number} value={r.number}>Room {r.number}{r.guest ? ` — ${r.guest}` : ` (${r.status})`}</option>)}
              </select>
            </div>
            {/* Search + category filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={foodSearch} onChange={e=>setFoodSearch(e.target.value)} placeholder="Search dish…" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/25 text-white"/>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={()=>setFoodCatFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${foodCatFilter==="all"?"bg-amber-500 text-black border-amber-500":"border-white/10 bg-white/5 text-white/50 hover:text-white"}`}>All</button>
              {foodCatsWithItems.map(c=>(
                <button key={c.id} onClick={()=>setFoodCatFilter(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${foodCatFilter===c.id?"bg-amber-500 text-black border-amber-500":"border-white/10 bg-white/5 text-white/50 hover:text-white"}`}>{c.name}</button>
              ))}
            </div>
            {/* Menu grid */}
            {availableMenu.length===0 ? (
              <div className="text-center py-12 text-white/30"><Coffee className="h-12 w-12 mx-auto mb-3"/><p className="text-sm">No menu items{foodSearch?` for “${foodSearch}”`:""}</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableMenu.map(item=>{
                  const inCart = foodCart.find(c=>c.item.id===item.id);
                  return (
                    <button key={item.id} onClick={()=>addToFoodCart(item)} className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${inCart?"border-amber-500/40 bg-amber-500/10":"border-white/8 bg-white/[0.03] hover:border-white/20"}`}>
                      <span className="text-xs text-white/30">{catName(item.categoryId)}</span>
                      <span className="text-sm font-medium leading-tight">{item.name}</span>
                      <div className="flex items-center justify-between w-full mt-1">
                        <span className="text-sm font-bold text-amber-400">₹{item.price}</span>
                        {inCart&&<span className="h-5 w-5 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">{inCart.qty}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Food Cart */}
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 flex flex-col">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Coffee className="h-4 w-4 text-amber-400"/>Food Order</h3>
            {foodCart.length===0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/20">
                <Coffee className="h-10 w-10 mb-2"/><p className="text-sm">Select dishes</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {foodCart.map(c=>(
                  <div key={c.item.id} className="flex items-center gap-2">
                    <span className="text-sm flex-1 leading-tight">{c.item.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setFoodCart(prev=>prev.map(x=>x.item.id===c.item.id?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0))} className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 text-xs">−</button>
                      <span className="w-5 text-center text-xs font-bold">{c.qty}</span>
                      <button onClick={()=>setFoodCart(prev=>prev.map(x=>x.item.id===c.item.id?{...x,qty:x.qty+1}:x))} className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 text-xs">+</button>
                    </div>
                    <span className="text-sm font-bold text-amber-400 w-16 text-right">₹{c.item.price*c.qty}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-white/10 pt-3 space-y-3">
              <div className="flex justify-between font-extrabold text-lg">
                <span>Total</span>
                <span className="text-amber-400">₹{foodCartTotal}</span>
              </div>
              <button onClick={sendFoodOrder} disabled={!foodRoom||foodCartTotal===0||sendingFood} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                <ShoppingCart className="h-4 w-4"/>{sendingFood?"Sending…":`Send to Room ${foodRoom||"—"}`}
              </button>
              <p className="text-xs text-white/30 text-center">Charged to room bill · goes to kitchen (Service Requests)</p>
              <button onClick={()=>setFoodCart([])} disabled={foodCart.length===0} className="w-full py-2 rounded-xl border border-white/10 text-sm font-semibold text-white/50 hover:bg-white/5 disabled:opacity-30">Clear</button>
            </div>
          </div>
        </div>
      )}

      {tab==="minibar-pos"&&(
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-2 block">Select Room</label>
              <select value={posRoom} onChange={e=>setPosRoom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white">
                <option value="">-- Select Room --</option>
                {rooms.map(r=><option key={r.number} value={r.number}>Room {r.number}{r.guest ? ` — ${r.guest}` : ` (${r.status})`}</option>)}
              </select>
            </div>
            {(["beverages","snacks","amenities"] as const).map(cat=>(
              <div key={cat}>
                <h3 className="text-sm font-bold capitalize mb-2 text-white/70">{cat}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {minibar.filter(i=>i.category===cat).map(item=>{
                    const inCart = cart.find(c=>c.item.id===item.id);
                    return (
                      <button key={item.id} onClick={()=>addToCart(item)} className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${inCart?"border-amber-500/40 bg-amber-500/10":"border-white/8 bg-white/[0.03] hover:border-white/20"}`}>
                        <span className="text-sm">{item.name}</span>
                        <div className="flex items-center gap-2">
                          {inCart&&<span className="h-5 w-5 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">{inCart.qty}</span>}
                          <span className="text-sm font-bold text-amber-400">₹{item.price}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Cart */}
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 flex flex-col">
            <h3 className="font-bold mb-4 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-amber-400"/>Mini-Bar Bill</h3>
            {cart.length===0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/20">
                <Package className="h-10 w-10 mb-2"/><p className="text-sm">Select items</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {cart.map(c=>(
                  <div key={c.item.id} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{c.item.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={()=>setCart(prev=>prev.map(x=>x.item.id===c.item.id?{...x,qty:x.qty-1}:x).filter(x=>x.qty>0))} className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 text-xs">−</button>
                      <span className="w-5 text-center text-xs font-bold">{c.qty}</span>
                      <button onClick={()=>setCart(prev=>prev.map(x=>x.item.id===c.item.id?{...x,qty:x.qty+1}:x))} className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 text-xs">+</button>
                    </div>
                    <span className="text-sm font-bold text-amber-400 w-16 text-right">₹{c.item.price*c.qty}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-white/10 pt-3 space-y-3">
              <div className="flex justify-between font-extrabold text-lg">
                <span>Total</span>
                <span className="text-amber-400">₹{cartTotal}</span>
              </div>
              <button onClick={chargeMinbar} disabled={!posRoom||cartTotal===0} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                <CreditCard className="h-4 w-4"/>Charge to Room {posRoom||"—"}
              </button>
              <button onClick={()=>setCart([])} disabled={cart.length===0} className="w-full py-2 rounded-xl border border-white/10 text-sm font-semibold text-white/50 hover:bg-white/5 disabled:opacity-30">Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showNew&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">New Service Request</h2>
              <button onClick={()=>setShowNew(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Room</label>
                <select value={selectedRoom} onChange={e=>setSelectedRoom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white">
                  <option value="">-- Select Room --</option>
                  {rooms.map(r=><option key={r.number} value={r.number}>Room {r.number}{r.guest ? ` — ${r.guest}` : ` (${r.status})`}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Request Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_CFG).map(([k,c])=>(
                    <button key={k} onClick={()=>setRequestType(k as keyof typeof TYPE_CFG)} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-semibold transition-all ${requestType===k?`${c.bg} border-white/20 ${c.color}`:"border-white/8 bg-white/5 text-white/50"}`}>
                      <c.icon className="h-4 w-4"/>{c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Details / Items</label>
                <textarea value={requestNote} onChange={e=>setRequestNote(e.target.value)} placeholder="Describe the request..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 resize-none placeholder:text-white/20"/>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["normal","high","urgent"].map(p=>(
                    <button key={p} onClick={()=>setRequestPriority(p)} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${requestPriority===p?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/50"}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowNew(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={addRequest} disabled={!selectedRoom||!requestNote} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">Create Request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Guest Modal (WIP — gated) */}
      {FEATURES.hotelReception && checkinOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold flex items-center gap-2">
                {editingRoomId ? <Pencil className="h-4 w-4 text-emerald-400"/> : <UserPlus className="h-4 w-4 text-emerald-400"/>}
                {editingRoomId ? "Edit Room / Guest" : "Check-in Guest"}
              </h2>
              <button onClick={()=>setCheckinOpen(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Room No.*</label>
                  <input value={checkinForm.number} onChange={e=>setCheckinForm(f=>({...f,number:e.target.value}))} placeholder="101" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white placeholder:text-white/20"/>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Floor</label>
                  <input type="number" value={checkinForm.floor} onChange={e=>setCheckinForm(f=>({...f,floor:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Room Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {ROOM_TYPES.map(t=>(
                    <button key={t} onClick={()=>setCheckinForm(f=>({...f,type:t}))} className={`py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${checkinForm.type===t?"bg-emerald-500/20 border-emerald-500/40 text-emerald-300":"border-white/10 bg-white/5 text-white/50"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Status</label>
                <select value={checkinForm.status} onChange={e=>setCheckinForm(f=>({...f,status:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white capitalize">
                  {ROOM_STATUSES.map(s=><option key={s} value={s} className="bg-[#111827]">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Guest Name</label>
                <input value={checkinForm.guestName} onChange={e=>setCheckinForm(f=>({...f,guestName:e.target.value}))} placeholder="e.g. Chaturbhuj" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white placeholder:text-white/20"/>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Guest Mobile</label>
                <input value={checkinForm.guestPhone} onChange={e=>setCheckinForm(f=>({...f,guestPhone:e.target.value}))} placeholder="+91…" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white placeholder:text-white/20"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Check-in</label>
                  <input type="date" value={checkinForm.checkIn} onChange={e=>setCheckinForm(f=>({...f,checkIn:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white"/>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Check-out</label>
                  <input type="date" value={checkinForm.checkOut} onChange={e=>setCheckinForm(f=>({...f,checkOut:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Rate/Night ₹</label>
                  <input type="number" value={checkinForm.rate} onChange={e=>setCheckinForm(f=>({...f,rate:e.target.value}))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white placeholder:text-white/20"/>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Discount ₹</label>
                  <input type="number" value={checkinForm.discount} onChange={e=>setCheckinForm(f=>({...f,discount:e.target.value}))} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white placeholder:text-white/20"/>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-2 block uppercase tracking-wide">Guests</label>
                  <input type="number" value={checkinForm.guestCount} onChange={e=>setCheckinForm(f=>({...f,guestCount:e.target.value}))} placeholder="1" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 text-white placeholder:text-white/20"/>
                </div>
              </div>
              {editingRoomId && (
                <button onClick={()=>{ const n = checkinForm.number; setCheckinOpen(false); openFolio(n); }} className="w-full py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-semibold flex items-center justify-center gap-2">
                  <CreditCard className="h-4 w-4"/> View Bill / Folio
                </button>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={()=>setCheckinOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={saveCheckin} disabled={!checkinForm.number.trim()||savingCheckin} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm disabled:opacity-40">{savingCheckin?"Saving…":(editingRoomId?"Save":"Check-in")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Folio / Bill Modal (WIP — gated) */}
      {FEATURES.hotelReception && folioRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-400"/>Room {folioRoom} — Bill</h2>
              <button onClick={()=>{setFolioRoom(null);setFolioData(null);}}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            {folioLoading || !folioData ? (
              <div className="py-10 text-center text-white/40 text-sm">Loading bill…</div>
            ) : (
              <div className="space-y-4">
                {folioData.room?.guestName && (
                  <p className="text-xs text-white/50">Guest: <span className="text-white/80 font-semibold">{folioData.room.guestName}</span>{folioData.room.nights ? ` · ${folioData.room.nights} night(s)` : ""}</p>
                )}
                <div className="space-y-2">
                  {(folioData.lines || []).length === 0 && <p className="text-xs text-white/30 text-center py-4">No charges yet.</p>}
                  {(folioData.lines || []).map((l:any,i:number)=>(
                    <div key={i} className="flex items-start justify-between gap-3 text-sm border-b border-white/5 pb-2">
                      <div className="min-w-0">
                        <p className="text-white/80 truncate">{l.label}</p>
                        <p className="text-xs text-white/30">{l.typeLabel}</p>
                      </div>
                      <span className="font-semibold whitespace-nowrap">₹{Math.round(l.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-sm pt-1">
                  <div className="flex justify-between text-white/50"><span>Room Rent</span><span>₹{Math.round(folioData.roomRent||0)}</span></div>
                  <div className="flex justify-between text-white/50"><span>Services</span><span>₹{Math.round(folioData.servicesTotal||0)}</span></div>
                  {folioData.discount>0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>− ₹{Math.round(folioData.discount)}</span></div>}
                  <div className="flex justify-between font-extrabold text-lg pt-2 border-t border-white/10"><span>Total</span><span className="text-amber-400">₹{Math.round(folioData.total||0)}</span></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>{setFolioRoom(null);setFolioData(null);}} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Close</button>
                  <button onClick={doCheckout} disabled={checkingOut} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"><LogOut className="h-4 w-4"/>{checkingOut?"…":"Check-out & Settle"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service request full detail */}
      {detailReq && (() => {
        const req = detailReq;
        const tcfg = TYPE_CFG[req.type] || TYPE_CFG.food;
        const scfg = STATUS_CFG[req.status] || STATUS_CFG.pending;
        const items = Array.isArray(req.items) ? req.items : [];
        const rows: [string, string][] = [
          ["Room", `Room ${req.room}`],
          ["Guest", req.guestName || "—"],
          ["Mobile", req.guestPhone || "—"],
          ["Request type", tcfg.label],
          ["Status", scfg.label],
          ["Amount", req.charge > 0 ? `₹${req.charge.toLocaleString("en-IN")}` : "—"],
          ["Payment", req.paymentMethod ? req.paymentMethod.toUpperCase() : "Room bill"],
          ["Assigned to", req.assignedTo || "—"],
          ["Time", req.createdAt ? new Date(req.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : req.time || "—"],
        ];
        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailReq(null)}>
            <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 text-white max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base flex items-center gap-2"><span className={`h-7 w-7 rounded-lg ${tcfg.bg} ${tcfg.color} flex items-center justify-center`}><tcfg.icon className="h-4 w-4" /></span>Room {req.room}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                    {req.charge > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">₹{req.charge}</span>}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{req.guestName} · {tcfg.label}</p>
                </div>
                <button onClick={() => setDetailReq(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[11px] text-white/35">{k}</p>
                      <p className="text-sm font-medium break-all capitalize">{v}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-2">Order / Items</p>
                  {items.length > 0 ? (
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
                      {items.map((it, i) => (
                        <div key={i} className="flex justify-between gap-3 px-3 py-2 text-xs">
                          <span className="text-white/70 truncate">{it.name || it.description || "Item"}{(it.quantity || it.qty) ? ` × ${it.quantity || it.qty}` : ""}</span>
                          {it.price != null && <span className="text-white/80 shrink-0">₹{Number(it.price).toLocaleString("en-IN")}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/70">{req.item}</p>
                  )}
                  {req.notes && <p className="text-xs text-yellow-300/70 mt-2">⚠️ {req.notes}</p>}
                </div>

                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  {req.status === "pending" && <button onClick={() => { updateStatus(req.id, req.type === "food" ? "preparing" : "in-progress"); setDetailReq(null); }} className="flex-1 py-2.5 rounded-xl bg-blue-500/20 text-blue-300 text-sm font-bold hover:bg-blue-500/30">Accept</button>}
                  {(req.status === "preparing" || req.status === "in-progress") && <button onClick={() => { updateStatus(req.id, "completed"); setDetailReq(null); }} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30 flex items-center justify-center gap-1"><CheckCircle className="h-4 w-4" /> Mark Done</button>}
                  <button onClick={() => setDetailReq(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-semibold hover:bg-white/5">Close</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
