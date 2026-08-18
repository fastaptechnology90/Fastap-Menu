import { useState, useEffect, useCallback } from "react";
import { BedDouble, Wrench, CheckCircle, Clock, Plus, X, Search } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { housekeeping as housekeepingApi, staff as staffApi } from "@/lib/api";

type HKTask = {
  id: string; room: string; type: string; assignedTo: string; status: string;
  priority: string; startTime: string; endTime: string | null; notes: string;
  checklist: string[];
};

type MTTicket = {
  id: string; room: string; issue: string; type: string; assignedTo: string;
  status: string; priority: string; reportedAt: string; estimatedTime: string;
  cost: number; notes: string;
};

function fmtTime(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mapHK(t: any): HKTask {
  const hkStatus = t.status === "in_progress" ? "in-progress" : t.status;
  return {
    id: String(t.id),
    room: t.roomNumber || t.location || "—",
    type: t.type || "daily-clean",
    assignedTo: t.assignedTo || "Unassigned",
    status: hkStatus,
    priority: t.priority || "normal",
    startTime: fmtTime(t.scheduledAt || t.createdAt),
    endTime: t.completedAt ? fmtTime(t.completedAt) : null,
    notes: t.notes || t.description || "",
    checklist: t.description ? [t.description] : ["Task assigned"],
  };
}

function mapMT(m: any): MTTicket {
  const mtStatus = m.status === "open" ? "pending" : m.status === "resolved" ? "completed" : m.status === "in_progress" ? "in-progress" : m.status;
  return {
    id: String(m.id),
    room: m.location || "—",
    issue: m.title,
    type: m.category || "general",
    assignedTo: m.assignedTo || "Unassigned",
    status: mtStatus,
    priority: m.priority || "medium",
    reportedAt: fmtTime(m.createdAt),
    estimatedTime: "—",
    cost: parseFloat(String(m.estimatedCost || m.actualCost)) || 0,
    notes: m.description || "",
  };
}

const TASK_TYPE_CFG: Record<string,{label:string;color:string;bg:string}> = {
  "checkout-clean": {label:"Checkout Clean",color:"text-orange-400",bg:"bg-orange-500/15"},
  "daily-clean":    {label:"Daily Clean",color:"text-blue-400",bg:"bg-blue-500/15"},
  "deep-clean":     {label:"Deep Clean",color:"text-violet-400",bg:"bg-violet-500/15"},
  "turndown":       {label:"Turndown Service",color:"text-pink-400",bg:"bg-pink-500/15"},
  "common-area":    {label:"Common Area",color:"text-cyan-400",bg:"bg-cyan-500/15"},
};

const MAINT_TYPE_CFG: Record<string,{icon:string;color:string}> = {
  "ac-hvac":   {icon:"❄️",color:"text-cyan-400"},
  "plumbing":  {icon:"🔧",color:"text-blue-400"},
  "electrical":{icon:"⚡",color:"text-yellow-400"},
  "furniture": {icon:"🪑",color:"text-amber-400"},
  "security":  {icon:"🔒",color:"text-red-400"},
  "general":   {icon:"🛠️",color:"text-white/60"},
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  pending:     {label:"Pending",    color:"text-yellow-400",bg:"bg-yellow-500/15"},
  "in-progress":{label:"In Progress",color:"text-blue-400",bg:"bg-blue-500/15"},
  completed:   {label:"Completed",  color:"text-emerald-400",bg:"bg-emerald-500/15"},
  cancelled:   {label:"Cancelled",  color:"text-red-400",bg:"bg-red-500/15"},
};

const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  low:    {label:"Low",    color:"text-white/40"},
  normal: {label:"Normal", color:"text-white/60"},
  medium: {label:"Medium", color:"text-yellow-400"},
  high:   {label:"High",   color:"text-orange-400"},
  critical:{label:"Critical",color:"text-red-400"},
};
const priorityCfgOf = (p: string) => PRIORITY_CFG[p] || {label:p||"—",color:"text-white/60"};

type Tab = "housekeeping"|"maintenance"|"schedule";

export default function HousekeepingMaintenance() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("housekeeping");
  const [hkTasks, setHkTasks] = useState<HKTask[]>([]);
  const [mainTasks, setMainTasks] = useState<MTTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewHK, setShowNewHK] = useState(false);
  const [showNewMT, setShowNewMT] = useState(false);
  const [newHK, setNewHK] = useState({ room:"", type:"daily-clean", assignedTo:"", priority:"normal", notes:"" });
  const [newMT, setNewMT] = useState({ room:"", issue:"", type:"general", assignedTo:"", priority:"medium", estimatedTime:"", notes:"" });
  const [expandedTask, setExpandedTask] = useState<string|null>(null);
  const [staffList, setStaffList] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [hk, mt, staffRows] = await Promise.all([
        housekeepingApi.tasks(restaurantId),
        housekeepingApi.maintenanceList(restaurantId),
        staffApi.list(restaurantId).catch(() => []),
      ]);
      setHkTasks((Array.isArray(hk) ? hk : []).map(mapHK));
      setMainTasks((Array.isArray(mt) ? mt : []).map(mapMT));
      setStaffList((Array.isArray(staffRows) ? staffRows : []).map((s: { name?: string }) => s.name || "").filter(Boolean));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [restaurantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const hkStats = {
    pending: hkTasks.filter(t=>t.status==="pending").length,
    inProgress: hkTasks.filter(t=>t.status==="in-progress").length,
    completed: hkTasks.filter(t=>t.status==="completed").length,
  };
  const mtStats = {
    pending: mainTasks.filter(t=>t.status==="pending").length,
    inProgress: mainTasks.filter(t=>t.status==="in-progress").length,
    high: mainTasks.filter(t=>t.priority==="high"||t.priority==="critical").length,
  };

  async function updateHK(id: string, status: string) {
    if (!restaurantId) return;
    const apiStatus = status === "in-progress" ? "in_progress" : status;
    try {
      await housekeepingApi.updateTask(restaurantId, Number(id), { status: apiStatus });
      setHkTasks(t => t.map(x => x.id === id ? { ...x, status, endTime: status === "completed" ? fmtTime(new Date()) : x.endTime } : x));
    } catch (e) { console.error(e); }
  }

  async function updateMT(id: string, status: string, assignee?: string) {
    if (!restaurantId) return;
    const apiStatus = status === "pending" ? "open" : status === "in-progress" ? "in_progress" : status === "completed" ? "resolved" : status;
    try {
      await housekeepingApi.updateMaintenance(restaurantId, Number(id), { status: apiStatus, assignedTo: assignee || undefined });
      setMainTasks(t => t.map(x => x.id === id ? { ...x, status, assignedTo: assignee || x.assignedTo } : x));
    } catch (e) { console.error(e); }
  }

  async function createHK() {
    if (!newHK.room || !restaurantId) return;
    const label = TASK_TYPE_CFG[newHK.type]?.label || newHK.type;
    try {
      const created = await housekeepingApi.createTask(restaurantId, {
        type: newHK.type,
        title: label,
        description: newHK.notes,
        location: newHK.room,
        roomNumber: newHK.room,
        priority: newHK.priority,
        assignedTo: newHK.assignedTo || undefined,
      });
      setHkTasks(t => [mapHK(created), ...t]);
      setNewHK({ room:"", type:"daily-clean", assignedTo:"", priority:"normal", notes:"" });
      setShowNewHK(false);
    } catch (e) { console.error(e); }
  }

  const filteredHK = hkTasks.filter(t=>
    (statusFilter==="all"||t.status===statusFilter) &&
    (!search||t.room.toLowerCase().includes(search.toLowerCase())||t.assignedTo.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredMT = mainTasks.filter(t=>
    (statusFilter==="all"||t.status===statusFilter) &&
    (!search||t.room.toLowerCase().includes(search.toLowerCase())||t.issue.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading && hkTasks.length === 0 && mainTasks.length === 0) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading housekeeping data…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Housekeeping & Maintenance</h1>
          <p className="text-xs text-white/40">Room cleaning schedules and repair tracking</p>
        </div>
        <button onClick={()=>tab==="housekeeping"?setShowNewHK(true):setShowNewMT(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
          <Plus className="h-4 w-4"/>New {tab==="housekeeping"?"Task":"Ticket"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(tab !== "maintenance" ? [
          {label:"Pending",value:hkStats.pending,color:"text-yellow-400",bg:"bg-yellow-500/10"},
          {label:"In Progress",value:hkStats.inProgress,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Completed Today",value:hkStats.completed,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Total Tasks",value:hkTasks.length,color:"text-white",bg:"bg-white/5"},
        ] : [
          {label:"Open Tickets",value:mtStats.pending,color:"text-yellow-400",bg:"bg-yellow-500/10"},
          {label:"In Progress",value:mtStats.inProgress,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"High Priority",value:mtStats.high,color:"text-red-400",bg:"bg-red-500/10"},
          {label:"Total Tickets",value:mainTasks.length,color:"text-white",bg:"bg-white/5"},
        ]).map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div><p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
          {([["housekeeping","Housekeeping"],["maintenance","Maintenance"],["schedule","Schedule"]] as [Tab,string][]).map(([t,l])=>(
            <button key={t} onClick={()=>{setTab(t);setStatusFilter("all");}} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30"/>
            <input className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/30" placeholder="Search room, staff..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="flex gap-1">
            {["all","pending","in-progress","completed"].map(s=>(
              <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-2 rounded-xl text-xs font-semibold border capitalize transition-all ${statusFilter===s?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{s==="all"?"All":s}</button>
            ))}
          </div>
        </div>
      </div>

      {tab==="housekeeping"&&(
        <div className="space-y-3">
          {filteredHK.map(task=>{
            const tcfg = TASK_TYPE_CFG[task.type]||{label:task.type,color:"text-white/60",bg:"bg-white/10"};
            const scfg = STATUS_CFG[task.status] || STATUS_CFG.pending;
            const expanded = expandedTask===task.id;
            return (
              <div key={task.id} className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <div className={`h-10 w-10 rounded-xl ${tcfg.bg} flex items-center justify-center ${tcfg.color} shrink-0`}><BedDouble className="h-5 w-5"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">Room {task.room}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-white/10 ${priorityCfgOf(task.priority).color}`}>{priorityCfgOf(task.priority).label}</span>
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{tcfg.label} · {task.assignedTo||"Unassigned"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/30">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Start: {task.startTime}</span>
                      {task.endTime&&<span>Done: {task.endTime}</span>}
                    </div>
                    {task.notes&&<p className="text-xs text-white/40 mt-1">📝 {task.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={()=>setExpandedTask(expanded?null:task.id)} className="text-xs text-amber-400 hover:text-amber-300">{expanded?"Hide":"Checklist"}</button>
                    {task.status==="pending"&&<button onClick={()=>updateHK(task.id,"in-progress")} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30">Start</button>}
                    {task.status==="in-progress"&&<button onClick={()=>updateHK(task.id,"completed")} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Done</button>}
                  </div>
                </div>
                {expanded&&(
                  <div className="px-4 pb-4 border-t border-white/5 pt-3">
                    <p className="text-xs text-white/40 mb-2 font-semibold uppercase tracking-wide">Checklist</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {task.checklist.map((item,i)=>(
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${task.status==="completed"?"text-emerald-400":"text-white/20"}`}/>
                          <span className={task.status==="completed"?"text-white/40 line-through":"text-white/70"}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredHK.length===0&&<div className="text-center py-12 text-white/30"><BedDouble className="h-12 w-12 mx-auto mb-3"/><p>No tasks found</p></div>}
        </div>
      )}

      {tab==="maintenance"&&(
        <div className="space-y-3">
          {filteredMT.map(ticket=>{
            const tcfg = MAINT_TYPE_CFG[ticket.type]||MAINT_TYPE_CFG.general;
            const scfg = STATUS_CFG[ticket.status] || STATUS_CFG.pending;
            return (
              <div key={ticket.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-xl shrink-0">{tcfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">{ticket.room}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-white/10 ${priorityCfgOf(ticket.priority).color}`}>{priorityCfgOf(ticket.priority).label}</span>
                    </div>
                    <p className="text-sm text-white/80 mt-1">{ticket.issue}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                      <span>Reported: {ticket.reportedAt}</span>
                      <span>Est: {ticket.estimatedTime}</span>
                      {ticket.assignedTo&&ticket.assignedTo!=="Unassigned"&&<span>👤 {ticket.assignedTo}</span>}
                      {ticket.cost>0&&<span className="text-amber-400">₹{ticket.cost} est. cost</span>}
                    </div>
                    {ticket.notes&&<p className="text-xs text-white/40 mt-1">📝 {ticket.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {ticket.status==="pending"&&(
                      <>
                        <select onChange={e=>updateMT(ticket.id,"in-progress",e.target.value)} defaultValue="" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none text-white">
                          <option value="">Assign staff</option>
                          {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={()=>updateMT(ticket.id,"in-progress")} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30">Start</button>
                      </>
                    )}
                    {ticket.status==="in-progress"&&<button onClick={()=>updateMT(ticket.id,"completed")} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30">Resolve</button>}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredMT.length===0&&<div className="text-center py-12 text-white/30"><Wrench className="h-12 w-12 mx-auto mb-3"/><p>No tickets found</p></div>}
        </div>
      )}

      {tab==="schedule"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Today's HK Schedule</h3>
            <div className="space-y-2">
              {["08:00 AM","09:00 AM","10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM","03:00 PM"].map(time=>{
                const task = hkTasks.find(t=>t.startTime===time);
                return (
                  <div key={time} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <span className="text-xs text-white/40 w-20 shrink-0">{time}</span>
                    {task ? (
                      <div className={`flex-1 rounded-lg px-3 py-1.5 ${(STATUS_CFG[task.status] || STATUS_CFG.pending).bg}`}>
                        <p className="text-xs font-semibold">Room {task.room} — {TASK_TYPE_CFG[task.type]?.label||task.type}</p>
                        <p className="text-xs text-white/40">{task.assignedTo}</p>
                      </div>
                    ) : (
                      <div className="flex-1 rounded-lg px-3 py-1.5 bg-white/3 border border-dashed border-white/10">
                        <p className="text-xs text-white/20">Available</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Staff Workload</h3>
            <div className="space-y-3">
              {staffList.map(staff=>{
                const tasks = hkTasks.filter(t=>t.assignedTo===staff);
                const done = tasks.filter(t=>t.status==="completed").length;
                return (
                  <div key={staff}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/70">{staff}</span>
                      <span className="text-white/40">{done}/{tasks.length} tasks</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 transition-all" style={{width:`${tasks.length?((done/tasks.length)*100):0}%`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New HK Modal */}
      {showNewHK&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">New Housekeeping Task</h2>
              <button onClick={()=>setShowNewHK(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              {[{label:"Room / Area",key:"room",placeholder:"e.g. 101, Lobby, Pool area"}].map(f=>(
                <div key={f.key}><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(newHK as any)[f.key]} onChange={e=>setNewHK(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                </div>
              ))}
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Task Type</label>
                <select value={newHK.type} onChange={e=>setNewHK(p=>({...p,type:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white">
                  {Object.entries(TASK_TYPE_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Assign To</label>
                <select value={newHK.assignedTo} onChange={e=>setNewHK(p=>({...p,assignedTo:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white">
                  <option value="">-- Select Staff --</option>
                  {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["normal","high"].map(p=><button key={p} onClick={()=>setNewHK(pr=>({...pr,priority:p}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${newHK.priority===p?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/50"}`}>{p}</button>)}
                </div>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Notes</label>
                <textarea value={newHK.notes} onChange={e=>setNewHK(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Special instructions..." className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-white/20"/>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowNewHK(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={createHK} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm">Create Task</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
