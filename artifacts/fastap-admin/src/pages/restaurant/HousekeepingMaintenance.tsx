import { useState, useEffect, useCallback } from "react";
import { BedDouble, Wrench, CheckCircle, Clock, Plus, X, Search, Snowflake, Zap, Armchair, Lock, Hammer, StickyNote, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { housekeeping as housekeepingApi, staff as staffApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

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
  "checkout-clean": {label:"Checkout Clean",color:"text-warning",bg:"bg-warning-subtle"},
  "daily-clean":    {label:"Daily Clean",color:"text-info",bg:"bg-info-subtle"},
  "deep-clean":     {label:"Deep Clean",color:"text-muted-foreground",bg:"bg-muted"},
  "turndown":       {label:"Turndown Service",color:"text-muted-foreground",bg:"bg-muted"},
  "common-area":    {label:"Common Area",color:"text-info",bg:"bg-info-subtle"},
};

const MAINT_TYPE_CFG: Record<string,{icon:LucideIcon;color:string}> = {
  "ac-hvac":   {icon:Snowflake,color:"text-info"},
  "plumbing":  {icon:Wrench,color:"text-info"},
  "electrical":{icon:Zap,color:"text-warning"},
  "furniture": {icon:Armchair,color:"text-primary"},
  "security":  {icon:Lock,color:"text-danger"},
  "general":   {icon:Hammer,color:"text-muted-foreground"},
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  pending:     {label:"Pending",    color:"text-warning",bg:"bg-warning-subtle"},
  "in-progress":{label:"In Progress",color:"text-info",bg:"bg-info-subtle"},
  completed:   {label:"Completed",  color:"text-success",bg:"bg-success-subtle"},
  cancelled:   {label:"Cancelled",  color:"text-danger",bg:"bg-danger-subtle"},
};

const PRIORITY_CFG: Record<string,{label:string;color:string}> = {
  low:    {label:"Low",    color:"text-muted-foreground"},
  normal: {label:"Normal", color:"text-muted-foreground"},
  medium: {label:"Medium", color:"text-warning"},
  high:   {label:"High",   color:"text-warning"},
  critical:{label:"Critical",color:"text-danger"},
};
const priorityCfgOf = (p: string) => PRIORITY_CFG[p] || {label:p||"—",color:"text-muted-foreground"};

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

  const loadData = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
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
    finally { if (!silent) setLoading(false); }
  }, [restaurantId]);

  // Guest housekeeping / maintenance requests arrive while this page is open.
  // Without a poll they stayed invisible until someone reloaded the page.
  useEffect(() => {
    loadData();
    const t = setInterval(() => loadData(true), 15000);
    return () => clearInterval(t);
  }, [loadData]);

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
      toast({ title: status === "completed" ? "Task completed" : status === "in-progress" ? "Task started" : "Task updated" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to update task", description: e?.message, variant: "destructive" });
    }
  }

  async function updateMT(id: string, status: string, assignee?: string) {
    if (!restaurantId) return;
    const apiStatus = status === "pending" ? "open" : status === "in-progress" ? "in_progress" : status === "completed" ? "resolved" : status;
    try {
      await housekeepingApi.updateMaintenance(restaurantId, Number(id), { status: apiStatus, assignedTo: assignee || undefined });
      setMainTasks(t => t.map(x => x.id === id ? { ...x, status, assignedTo: assignee || x.assignedTo } : x));
      toast({ title: assignee ? `Assigned to ${assignee}` : status === "completed" ? "Ticket resolved" : status === "in-progress" ? "Ticket started" : "Ticket updated" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to update ticket", description: e?.message, variant: "destructive" });
    }
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
      toast({ title: "Housekeeping task created" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to create task", description: e?.message, variant: "destructive" });
    }
  }

  async function createMT() {
    if (!newMT.issue || !restaurantId) return;
    try {
      const created = await housekeepingApi.createMaintenance(restaurantId, {
        title: newMT.issue,
        category: newMT.type,
        location: newMT.room,
        priority: newMT.priority,
        description: newMT.notes,
        assignedTo: newMT.assignedTo || undefined,
      });
      setMainTasks(t => [mapMT(created), ...t]);
      setNewMT({ room:"", issue:"", type:"general", assignedTo:"", priority:"medium", estimatedTime:"", notes:"" });
      setShowNewMT(false);
      toast({ title: "Maintenance ticket created" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to create ticket", description: e?.message, variant: "destructive" });
    }
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
    return <div className="p-6 text-center text-muted-foreground text-sm">Loading housekeeping data…</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Housekeeping & Maintenance</h1>
          <p className="text-xs text-muted-foreground">Room cleaning schedules and repair tracking</p>
        </div>
        <button onClick={()=>tab==="housekeeping"?setShowNewHK(true):setShowNewMT(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors">
          <Plus className="h-4 w-4"/>New {tab==="housekeeping"?"Task":"Ticket"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(tab !== "maintenance" ? [
          {label:"Pending",value:hkStats.pending,color:"text-warning",bg:"bg-warning-subtle"},
          {label:"In Progress",value:hkStats.inProgress,color:"text-info",bg:"bg-info-subtle"},
          {label:"Completed Today",value:hkStats.completed,color:"text-success",bg:"bg-success-subtle"},
          {label:"Total Tasks",value:hkTasks.length,color:"text-foreground",bg:"bg-muted"},
        ] : [
          {label:"Open Tickets",value:mtStats.pending,color:"text-warning",bg:"bg-warning-subtle"},
          {label:"In Progress",value:mtStats.inProgress,color:"text-info",bg:"bg-info-subtle"},
          {label:"High Priority",value:mtStats.high,color:"text-danger",bg:"bg-danger-subtle"},
          {label:"Total Tickets",value:mainTasks.length,color:"text-foreground",bg:"bg-muted"},
        ]).map(s => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4 flex items-center gap-3`}>
            <div><p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {([["housekeeping","Housekeeping"],["maintenance","Maintenance"],["schedule","Schedule"]] as [Tab,string][]).map(([t,l])=>(
            <button key={t} onClick={()=>{setTab(t);setStatusFilter("all");}} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <input className="w-full bg-muted border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground" placeholder="Search room, staff..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div className="flex gap-1">
            {["all","pending","in-progress","completed"].map(s=>(
              <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${statusFilter===s?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{s==="all"?"All":s}</button>
            ))}
          </div>
        </div>
      </div>

      {tab==="housekeeping"&&(
        <div className="space-y-3">
          {filteredHK.map(task=>{
            const tcfg = TASK_TYPE_CFG[task.type]||{label:task.type,color:"text-muted-foreground",bg:"bg-muted"};
            const scfg = STATUS_CFG[task.status] || STATUS_CFG.pending;
            const expanded = expandedTask===task.id;
            return (
              <div key={task.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <div className={`h-10 w-10 rounded-lg ${tcfg.bg} flex items-center justify-center ${tcfg.color} shrink-0`}><BedDouble className="h-5 w-5"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">Room {task.room}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-muted ${priorityCfgOf(task.priority).color}`}>{priorityCfgOf(task.priority).label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{tcfg.label} · {task.assignedTo||"Unassigned"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Start: {task.startTime}</span>
                      {task.endTime&&<span>Done: {task.endTime}</span>}
                    </div>
                    {task.notes&&<p className="text-xs text-muted-foreground mt-1"><StickyNote className="h-3 w-3 inline mb-0.5" /> {task.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={()=>setExpandedTask(expanded?null:task.id)} className="text-xs text-primary hover:text-primary">{expanded?"Hide":"Checklist"}</button>
                    {task.status==="pending"&&<button onClick={()=>updateHK(task.id,"in-progress")} className="px-3 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate">Start</button>}
                    {task.status==="in-progress"&&<button onClick={()=>updateHK(task.id,"completed")} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate flex items-center gap-1"><CheckCircle className="h-3 w-3"/>Done</button>}
                  </div>
                </div>
                {expanded&&(
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">Checklist</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {task.checklist.map((item,i)=>(
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${task.status==="completed"?"text-success":"text-muted-foreground"}`}/>
                          <span className={task.status==="completed"?"text-muted-foreground line-through":"text-foreground"}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredHK.length===0&&<div className="text-center py-12 text-muted-foreground"><BedDouble className="h-12 w-12 mx-auto mb-3"/><p>No tasks found</p></div>}
        </div>
      )}

      {tab==="maintenance"&&(
        <div className="space-y-3">
          {filteredMT.map(ticket=>{
            const tcfg = MAINT_TYPE_CFG[ticket.type]||MAINT_TYPE_CFG.general;
            const scfg = STATUS_CFG[ticket.status] || STATUS_CFG.pending;
            return (
              <div key={ticket.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg bg-warning-subtle flex items-center justify-center shrink-0 ${tcfg.color}`}><tcfg.icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{ticket.room}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scfg.bg} ${scfg.color}`}>{scfg.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-muted ${priorityCfgOf(ticket.priority).color}`}>{priorityCfgOf(ticket.priority).label}</span>
                    </div>
                    <p className="text-sm text-foreground mt-1">{ticket.issue}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Reported: {ticket.reportedAt}</span>
                      <span>Est: {ticket.estimatedTime}</span>
                      {ticket.assignedTo&&ticket.assignedTo!=="Unassigned"&&<span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{ticket.assignedTo}</span>}
                      {ticket.cost>0&&<span className="text-primary">₹{ticket.cost} est. cost</span>}
                    </div>
                    {ticket.notes&&<p className="text-xs text-muted-foreground mt-1"><StickyNote className="h-3 w-3 inline mb-0.5" /> {ticket.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {ticket.status==="pending"&&(
                      <>
                        <select onChange={e=>updateMT(ticket.id,"in-progress",e.target.value)} defaultValue="" className="bg-muted border border-border rounded-lg px-2 py-1 text-xs focus:outline-none text-foreground">
                          <option value="">Assign staff</option>
                          {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={()=>updateMT(ticket.id,"in-progress")} className="px-3 py-1.5 rounded-lg bg-info-subtle text-info text-xs font-semibold hover-elevate">Start</button>
                      </>
                    )}
                    {ticket.status==="in-progress"&&<button onClick={()=>updateMT(ticket.id,"completed")} className="px-3 py-1.5 rounded-lg bg-success-subtle text-success text-xs font-semibold hover-elevate">Resolve</button>}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredMT.length===0&&<div className="text-center py-12 text-muted-foreground"><Wrench className="h-12 w-12 mx-auto mb-3"/><p>No tickets found</p></div>}
        </div>
      )}

      {tab==="schedule"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Today's HK Schedule</h3>
            <div className="space-y-2">
              {["08:00 AM","09:00 AM","10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM","03:00 PM"].map(time=>{
                const task = hkTasks.find(t=>t.startTime===time);
                return (
                  <div key={time} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{time}</span>
                    {task ? (
                      <div className={`flex-1 rounded-lg px-3 py-1.5 ${(STATUS_CFG[task.status] || STATUS_CFG.pending).bg}`}>
                        <p className="text-xs font-semibold">Room {task.room} — {TASK_TYPE_CFG[task.type]?.label||task.type}</p>
                        <p className="text-xs text-muted-foreground">{task.assignedTo}</p>
                      </div>
                    ) : (
                      <div className="flex-1 rounded-lg px-3 py-1.5 bg-muted border border-dashed border-border">
                        <p className="text-xs text-muted-foreground">Available</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold mb-4">Staff Workload</h3>
            <div className="space-y-3">
              {staffList.map(staff=>{
                const tasks = hkTasks.filter(t=>t.assignedTo===staff);
                const done = tasks.filter(t=>t.status==="completed").length;
                return (
                  <div key={staff}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground">{staff}</span>
                      <span className="text-muted-foreground">{done}/{tasks.length} tasks</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-colors" style={{width:`${tasks.length?((done/tasks.length)*100):0}%`}}/>
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
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">New Housekeeping Task</h2>
              <button onClick={()=>setShowNewHK(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-4">
              {[{label:"Room / Area",key:"room",placeholder:"e.g. 101, Lobby, Pool area"}].map(f=>(
                <div key={f.key}><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(newHK as any)[f.key]} onChange={e=>setNewHK(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                </div>
              ))}
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Task Type</label>
                <select value={newHK.type} onChange={e=>setNewHK(p=>({...p,type:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                  {Object.entries(TASK_TYPE_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Assign To</label>
                <select value={newHK.assignedTo} onChange={e=>setNewHK(p=>({...p,assignedTo:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                  <option value="">-- Select Staff --</option>
                  {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["normal","high"].map(p=><button key={p} onClick={()=>setNewHK(pr=>({...pr,priority:p}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${newHK.priority===p?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{p}</button>)}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Notes</label>
                <textarea value={newHK.notes} onChange={e=>setNewHK(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Special instructions..." className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-muted-foreground"/>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowNewHK(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={createHK} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm">Create Task</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Maintenance Ticket Modal */}
      {showNewMT&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">New Maintenance Ticket</h2>
              <button onClick={()=>setShowNewMT(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-4">
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Room / Area</label>
                <input value={newMT.room} onChange={e=>setNewMT(p=>({...p,room:e.target.value}))} placeholder="e.g. 204, Lobby, Kitchen" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Issue / Title *</label>
                <input value={newMT.issue} onChange={e=>setNewMT(p=>({...p,issue:e.target.value}))} placeholder="e.g. AC not cooling" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Category</label>
                <select value={newMT.type} onChange={e=>setNewMT(p=>({...p,type:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                  {Object.entries(MAINT_TYPE_CFG).map(([k,v])=><option key={k} value={k}>{k.replace("-"," ").replace(/\b\w/g, c=>c.toUpperCase())}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Assign To</label>
                <select value={newMT.assignedTo} onChange={e=>setNewMT(p=>({...p,assignedTo:e.target.value}))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none text-foreground">
                  <option value="">-- Select Staff --</option>
                  {staffList.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["low","medium","high","critical"].map(p=><button key={p} onClick={()=>setNewMT(pr=>({...pr,priority:p}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${newMT.priority===p?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{p}</button>)}
                </div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Description</label>
                <textarea value={newMT.notes} onChange={e=>setNewMT(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Describe the problem..." className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-muted-foreground"/>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowNewMT(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={createMT} disabled={!newMT.issue} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40">Create Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
