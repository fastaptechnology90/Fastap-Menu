import { useState, useEffect, useRef, useCallback } from "react";
import { DollarSign, MessageSquare, Send, CheckSquare, Plus, X, TrendingUp, Award, Users, ChevronRight, Star, Clock, Wallet, Target } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { commissionsApi, tasksSop as tasksApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { toast } from "@/hooks/use-toast";

type CommissionRow = { id: string; name: string; role: string; avatar: string; sales: number; commission: number; tips: number; orders: number; avg: number; rating: number; target: number; shift: string };
type MessageRow = { id: string; from: string; role: string; body: string; time: string; type: string };
type TaskRow = { id: string; title: string; assignedTo: string; priority: string; status: string; dueBy: string };

const ACHIEVEMENT_BADGES = [
  { label:"Top Sales",    icon:"🏆", color:"text-yellow-400" },
  { label:"High Rating",  icon:"⭐", color:"text-amber-400" },
  { label:"Most Orders",  icon:"🍽️", color:"text-orange-400" },
  { label:"Best Tips",    icon:"💰", color:"text-emerald-400" },
];

type Tab = "commissions"|"chat"|"tasks";

export default function StaffCommissionChat() {
  const { restaurantId, currentStaff, staffList } = useRestaurant();
  const [tab, setTab] = useState<Tab>("commissions");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [msg, setMsg] = useState("");
  const [period, setPeriod] = useState<"today"|"week"|"month">("week");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title:"", assignedTo:"", dueBy:"", priority:"normal" });
  const msgEndRef = useRef<HTMLDivElement>(null);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);

  useEffect(()=>{
    if(!restaurantId)return;
    commissionsApi.list(restaurantId).then((d: any) => {
      if (Array.isArray(d) && d.length > 0) {
        const periodStart = period === "today"
          ? (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })()
          : period === "week"
            ? (() => { const t = new Date(); t.setDate(t.getDate() - 7); return t; })()
            : (() => { const t = new Date(); t.setDate(t.getDate() - 30); return t; })();
        const filtered = d.filter((c: any) => !c.createdAt || new Date(c.createdAt) >= periodStart);
        const byStaff = new Map<string, { sales: number; commission: number; tips: number; orders: number; name: string; role: string }>();
        for (const c of filtered) {
          const key = c.staffName || "Staff";
          const cur = byStaff.get(key) ?? { sales: 0, commission: 0, tips: 0, orders: 0, name: key, role: c.staffRole || "Waiter" };
          const amt = parseFloat(String(c.amount || 0));
          if (c.type === "tip") cur.tips += amt;
          else cur.commission += amt;
          if (c.orderId) { cur.orders += 1; cur.sales += amt * 10; }
          byStaff.set(key, cur);
        }
        const rows = [...byStaff.entries()].map(([name, v], i) => {
          const staffMember = staffList.find(s => s.name === name);
          const performanceScore = staffMember?.performance ?? 0;
          return {
            id: `S${String(i + 1).padStart(2, "0")}`,
            name: v.name,
            role: v.role,
            avatar: "🍽️",
            sales: v.sales,
            commission: v.commission,
            tips: v.tips,
            orders: v.orders,
            avg: v.orders ? Math.round(v.sales / v.orders) : 0,
            rating: performanceScore > 0 ? Math.min(5, performanceScore / 20) : 0,
            target: 0,
            shift: staffMember?.shift ? staffMember.shift.charAt(0).toUpperCase() + staffMember.shift.slice(1) : "—",
          };
        });
        const maxSales = Math.max(...rows.map(r => r.sales), 1);
        setCommissions(rows.map(r => ({ ...r, target: maxSales })));
      } else {
        setCommissions([]);
      }
    }).catch(() => {});
    commissionsApi.chatMessages(restaurantId).then((rows: any[]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        setMessages(rows.map(m => ({
          id: String(m.id),
          from: m.senderName || "Staff",
          role: m.senderRole || "staff",
          body: m.message || "",
          time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
          type: m.messageType || "message",
        })));
      }
    }).catch(() => {});
    tasksApi.tasks(restaurantId).then((rows: any[]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        setTasks(rows.map(t => ({
          id: String(t.id),
          title: t.title || t.name || "Task",
          assignedTo: t.assignedTo || t.assignee || "Unassigned",
          priority: t.priority || "normal",
          status: t.status || "pending",
          dueBy: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—",
        })));
      }
    }).catch(() => {});
  },[restaurantId, period, staffList]);

  useEffect(()=>{ msgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  async function sendMessage() {
    if (!msg.trim() || !restaurantId) return;
    const body = msg.trim();
    setMsg("");
    const optimistic = {
      id: `M${Date.now()}`,
      from: currentStaff?.name ? `${currentStaff.name} (${currentStaff.role})` : "You (Manager)",
      role: currentStaff?.role || "manager",
      body,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      type: "message" as const,
    };
    setMessages(m => [...m, optimistic]);
    try {
      await commissionsApi.sendChat(restaurantId, {
        senderName: currentStaff?.name || "Manager",
        senderRole: currentStaff?.role || "manager",
        message: body,
        messageType: "message",
        channel: "general",
      });
    } catch (e: any) {
      setMessages(m => m.filter(x => x.id !== optimistic.id));
      setMsg(body);
      toast({ title: "Message not sent", description: e?.message || "Could not reach the server.", variant: "destructive" });
    }
  }

  const reloadTasks = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const rows: any[] = await tasksApi.tasks(restaurantId);
      if (Array.isArray(rows)) {
        setTasks(rows.map(t => ({
          id: String(t.id),
          title: t.title || t.name || "Task",
          assignedTo: t.assignedTo || t.assignee || "Unassigned",
          priority: t.priority || "normal",
          status: t.status || "pending",
          dueBy: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—",
        })));
      }
    } catch { /* keep current list */ }
  }, [restaurantId]);

  async function submitTask() {
    if (!newTask.title || !restaurantId) return;
    // Only forward a parseable date to the API; free-text (e.g. "End of shift") is display-only.
    const parsedDue = newTask.dueBy && !isNaN(Date.parse(newTask.dueBy)) ? newTask.dueBy : undefined;
    const optimistic: TaskRow = {
      id: `TK${Date.now()}`,
      title: newTask.title,
      assignedTo: newTask.assignedTo || "All Staff",
      priority: newTask.priority,
      status: "active",
      dueBy: newTask.dueBy || "—",
    };
    setTasks(t => [optimistic, ...t]);
    setShowAddTask(false);
    const payload = { title: optimistic.title, assignedTo: optimistic.assignedTo, priority: newTask.priority, dueDate: parsedDue };
    setNewTask({ title: "", assignedTo: "", dueBy: "", priority: "normal" });
    try {
      await tasksApi.createTask(restaurantId, payload);
      toast({ title: "Task assigned", description: payload.title });
      await reloadTasks();
    } catch (e: any) {
      setTasks(t => t.filter(x => x.id !== optimistic.id));
      toast({ title: "Could not assign task", description: e?.message || "Please try again.", variant: "destructive" });
    }
  }

  async function toggleTask(task: TaskRow) {
    if (!restaurantId) return;
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const prev = tasks;
    setTasks(t => t.map(x => x.id === task.id ? { ...x, status: newStatus } : x));
    try {
      await tasksApi.updateTask(restaurantId, parseInt(task.id, 10), { status: newStatus });
      toast({ title: newStatus === "completed" ? "Task completed" : "Task reopened", description: task.title });
    } catch (e: any) {
      setTasks(prev);
      toast({ title: "Could not update task", description: e?.message || "Please try again.", variant: "destructive" });
    }
  }

  const totalSales = commissions.reduce((s,c)=>s+c.sales,0);
  const totalCommission = commissions.reduce((s,c)=>s+c.commission,0);
  const totalTips = commissions.reduce((s,c)=>s+c.tips,0);
  const avgRating = commissions.length
    ? commissions.filter(c => c.rating > 0).reduce((s, c) => s + c.rating, 0) / (commissions.filter(c => c.rating > 0).length || 1)
    : 0;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Staff Commissions & Chat</h1>
          <p className="text-xs text-white/40">Performance tracking, tips and team communication</p>
        </div>
        {tab==="tasks"&&<button onClick={()=>setShowAddTask(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all"><Plus className="h-4 w-4"/>Add Task</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Team Sales",value:`₹${(totalSales/1000).toFixed(0)}K`,icon:TrendingUp,color:"text-amber-400",bg:"bg-amber-500/10"},
          {label:"Commissions",value:`₹${totalCommission.toLocaleString()}`,icon:DollarSign,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Total Tips",value:`₹${totalTips.toLocaleString()}`,icon:Wallet,color:"text-violet-400",bg:"bg-violet-500/10"},
          {label:"Avg Performance",value:avgRating > 0 ? `${avgRating.toFixed(1)}★` : "—",icon:Star,color:"text-yellow-400",bg:"bg-yellow-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["commissions","Commissions"],["chat","Team Chat"],["tasks","Task Board"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="commissions"&&(
        <div className="space-y-4">
          {commissions.length === 0 ? <EmptyState title="No commission data yet" /> : <>
          <div className="flex gap-2">
            {(["today","week","month"] as const).map(p=>(
              <button key={p} onClick={()=>setPeriod(p)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${period===p?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{p==="today"?"Today":p==="week"?"This Week":"This Month"}</button>
            ))}
          </div>

          {/* Leaderboard */}
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 mb-2">
            <h3 className="text-sm font-bold mb-3 text-white/70">🏆 Leaderboard</h3>
            <div className="space-y-2">
              {[...commissions].sort((a,b)=>b.sales-a.sales).map((s,i)=>(
                <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${i===0?"bg-amber-500/10 border border-amber-500/20":""}`}>
                  <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${i===0?"bg-amber-500 text-black":i===1?"bg-slate-400 text-black":i===2?"bg-amber-700 text-white":"bg-white/10 text-white/50"}`}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                  </span>
                  <span className="text-xl">{s.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{s.name} <span className="text-white/40 font-normal text-xs">({s.role})</span></p>
                    <div className="h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{width:`${Math.min(100,(s.sales/Math.max(...commissions.map(c=>c.sales)))*100)}%`}}/>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-amber-400">₹{(s.sales/1000).toFixed(0)}K</p>
                    <p className="text-xs text-white/30">{s.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Cards */}
          {commissions.map(staff=>{
            const targetPct = Math.min(100,Math.round((staff.sales/staff.target)*100));
            return (
              <div key={staff.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-2xl shrink-0">{staff.avatar}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold">{staff.name}</h3>
                      <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">{staff.role}</span>
                      <span className="text-xs text-white/30">{staff.shift}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {staff.rating > 0 ? (
                        <>
                          {[...Array(5)].map((_,i)=><Star key={i} className={`h-3.5 w-3.5 ${i<Math.floor(staff.rating)?"text-yellow-400 fill-yellow-400":"text-white/15"}`}/>)}
                          <span className="text-xs text-white/40">{staff.rating.toFixed(1)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-white/30">No performance score</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-emerald-400">₹{(staff.commission+staff.tips).toLocaleString()}</p>
                    <p className="text-xs text-white/30">total earnings</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    {label:"Sales",value:`₹${(staff.sales/1000).toFixed(0)}K`,color:"text-amber-400"},
                    {label:"Commission",value:`₹${staff.commission}`,color:"text-emerald-400"},
                    {label:"Tips",value:`₹${staff.tips}`,color:"text-violet-400"},
                    {label:"Orders",value:staff.orders,color:"text-blue-400"},
                  ].map(m=>(
                    <div key={m.label} className="bg-white/5 rounded-lg p-2 text-center">
                      <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                      <p className="text-xs text-white/30">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/40">Monthly target</span>
                    <span className={`font-semibold ${targetPct>=100?"text-emerald-400":"text-amber-400"}`}>₹{(staff.sales/1000).toFixed(0)}K / ₹{(staff.target/1000).toFixed(0)}K ({targetPct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${targetPct>=100?"bg-emerald-500":"bg-amber-500"}`} style={{width:`${targetPct}%`}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </>}
        </div>
      )}

      {tab==="chat"&&(
        <div className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden flex flex-col" style={{height:"60vh"}}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-sm font-semibold">Team Chat</span>
            <span className="text-xs text-white/30">— {commissions.length} staff members</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? <EmptyState title="No team messages yet" /> : messages.map(m=>(
              <div key={m.id} className={`flex gap-3 ${m.role==="manager"||m.from==="You (Manager)"?"flex-row-reverse":""}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.role==="manager"?"bg-amber-500 text-black":m.role==="kitchen"?"bg-orange-500/30 text-orange-400":m.role==="system"?"bg-red-500/20 text-red-400":"bg-blue-500/20 text-blue-400"}`}>
                  {m.from[0]}
                </div>
                <div className={`max-w-xs ${m.role==="manager"||m.from==="You (Manager)"?"items-end":""} flex flex-col`}>
                  <div className={`px-3 py-2 rounded-2xl text-sm ${m.role==="manager"||m.from==="You (Manager)"?"bg-amber-500 text-black rounded-tr-sm":m.type==="alert"?"bg-red-500/15 border border-red-500/25 text-red-300 rounded-tl-sm":"bg-white/10 text-white/80 rounded-tl-sm"}`}>
                    {m.body}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 px-1">
                    <span className="text-xs text-white/25">{m.from}</span>
                    <span className="text-xs text-white/20">·</span>
                    <span className="text-xs text-white/20">{m.time}</span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={msgEndRef}/>
          </div>
          <div className="border-t border-white/5 p-3 flex gap-2">
            <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Type a message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
            <button onClick={sendMessage} disabled={!msg.trim()} className="h-10 w-10 rounded-xl bg-amber-500 hover:bg-amber-400 flex items-center justify-center disabled:opacity-40 transition-all">
              <Send className="h-4 w-4 text-black"/>
            </button>
          </div>
        </div>
      )}

      {tab==="tasks"&&(
        <div className="space-y-3">
          {tasks.map(task=>(
            <div key={task.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <button onClick={()=>toggleTask(task)} className={`h-6 w-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${task.status==="completed"?"bg-emerald-500 border-emerald-500":"border-white/25 hover:border-white/50"}`}>
                  {task.status==="completed"&&<CheckSquare className="h-4 w-4 text-white"/>}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${task.status==="completed"?"line-through text-white/40":"text-white"}`}>{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/40 flex-wrap">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{task.assignedTo}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Due: {task.dueBy}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${task.priority==="high"?"bg-orange-500/20 text-orange-400":"bg-white/10 text-white/30"}`}>{task.priority}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${task.status==="completed"?"bg-emerald-500/20 text-emerald-400":task.status==="active"?"bg-blue-500/20 text-blue-400":"bg-yellow-500/20 text-yellow-400"}`}>{task.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {tasks.length===0&&<div className="text-center py-12 text-white/30"><CheckSquare className="h-12 w-12 mx-auto mb-3 text-white/15"/><p>No tasks yet</p></div>}
        </div>
      )}

      {showAddTask&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Assign New Task</h2>
              <button onClick={()=>setShowAddTask(false)}><X className="h-5 w-5 text-white/40 hover:text-white"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Task",key:"title",placeholder:"What needs to be done?"},
                {label:"Assigned To",key:"assignedTo",placeholder:"Staff name or role"},
                {label:"Due By",key:"dueBy",placeholder:"e.g. End of shift, 6 PM"},
              ].map(f=>(
                <div key={f.key}><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(newTask as any)[f.key]} onChange={e=>setNewTask(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 placeholder:text-white/20"/>
                </div>
              ))}
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["normal","high"].map(p=><button key={p} onClick={()=>setNewTask(pr=>({...pr,priority:p}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${newTask.priority===p?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/50"}`}>{p}</button>)}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowAddTask(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={submitTask} disabled={!newTask.title} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm disabled:opacity-40">Assign Task</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
