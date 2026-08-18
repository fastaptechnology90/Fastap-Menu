import { useState, useEffect, useCallback } from "react";
import { BedDouble, Coffee, Shirt, Wrench, LogOut, Bell, Clock, CheckCircle, Plus, X, ShoppingCart, Package, CreditCard } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { roomService as roomServiceApi } from "@/lib/api";

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

type Tab = "requests"|"rooms"|"new-request"|"minibar-pos";

export default function RoomService() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<RoomRequest[]>([]);
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

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [reqData, roomData, minibarData] = await Promise.all([
        roomServiceApi.requests(restaurantId),
        roomServiceApi.rooms(restaurantId),
        roomServiceApi.minibar(restaurantId).catch(() => []),
      ]);
      const mappedReqs = (Array.isArray(reqData) ? reqData : []).map(mapRequest);
      const pendingCounts: Record<string, number> = {};
      mappedReqs.forEach(r => {
        if (["pending", "preparing", "in-progress"].includes(r.status)) {
          pendingCounts[r.room] = (pendingCounts[r.room] || 0) + 1;
        }
      });
      setRequests(mappedReqs);
      setRooms((Array.isArray(roomData) ? roomData : []).map(r => mapRoom(r, pendingCounts)));
      setMinibar(Array.isArray(minibarData) ? minibarData : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { loadData(); }, [loadData]);

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
        {([["requests","Service Requests"],["rooms","Room Status"],["minibar-pos","Mini-Bar POS"]] as [Tab,string][]).map(([t,l])=>(
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
              <div key={req.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
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
                  <div className="flex gap-2 shrink-0">
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
                <div key={room.number} className={`${cfg.bg} border border-white/10 rounded-2xl p-3 cursor-pointer hover:border-white/20 transition-all relative`}>
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

      {tab==="minibar-pos"&&(
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-2 block">Select Room</label>
              <select value={posRoom} onChange={e=>setPosRoom(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white">
                <option value="">-- Select Occupied Room --</option>
                {activeRooms.map(r=><option key={r.number} value={r.number}>Room {r.number} — {r.guest}</option>)}
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
                  {activeRooms.map(r=><option key={r.number} value={r.number}>Room {r.number} — {r.guest}</option>)}
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
    </div>
  );
}
