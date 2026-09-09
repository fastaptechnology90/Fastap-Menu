import { useState, useEffect, useRef, useCallback } from "react";
import { DollarSign, MessageSquare, Send, CheckSquare, Plus, X, TrendingUp, Award, Users, ChevronRight, Star, Clock, Wallet, Target, Trophy } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { commissionsApi, tasksSop as tasksApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { toast } from "@/hooks/use-toast";

type CommissionRow = { id: string; name: string; role: string; avatar: string; sales: number; commission: number; tips: number; orders: number; avg: number; rating: number; target: number; shift: string };
type MessageRow = { id: string; from: string; role: string; body: string; time: string; type: string };
type TaskRow = { id: string; title: string; assignedTo: string; priority: string; status: string; dueBy: string };

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
      const periodStart = period === "today"
        ? (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })()
        : period === "week"
          ? (() => { const t = new Date(); t.setDate(t.getDate() - 7); return t; })()
          : (() => { const t = new Date(); t.setDate(t.getDate() - 30); return t; })();
      const rowsIn: any[] = Array.isArray(d) ? d : [];
      const earned = rowsIn.filter(c => !c.createdAt || new Date(c.createdAt) >= periodStart);

      // Commission and tips come from the commission ledger. Sales do NOT: this used to
      // reconstruct them as `commission * 10`, which tracks the commission rate rather
      // than anything anybody sold, and read as zero for every venue that pays no
      // commission at all. The server now measures each person's paid orders directly.
      const byName = new Map<string, { commission: number; tips: number }>();
      for (const c of earned) {
        const key = c.staffName || "Staff";
        const cur = byName.get(key) ?? { commission: 0, tips: 0 };
        const amt = parseFloat(String(c.amount || 0)) || 0;
        if (c.type === "tip") cur.tips += amt; else cur.commission += amt;
        byName.set(key, cur);
      }

      const serving = staffList.filter(m => m.ordersServed > 0 || byName.has(m.name));
      const rows: CommissionRow[] = serving.map((m, i) => {
        const led = byName.get(m.name) ?? { commission: 0, tips: 0 };
        return {
          id: `S${String(i + 1).padStart(2, "0")}`,
          name: m.name,
          role: m.role,
          avatar: m.name.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase(),
          sales: m.salesTotal,
          commission: led.commission || m.commissionAccrued,
          tips: led.tips || m.tipsCollected,
          orders: m.ordersServed,
          avg: m.avgOrderValue,
          // A star rating built out of an unmeasured score is a made-up review. Until
          // something actually scores performance, this stays 0 and the card says so.
          rating: m.hasMeasuredPerformance && m.performance > 0 ? Math.min(5, m.performance / 20) : 0,
          target: 0,
          shift: m.shift ? m.shift.charAt(0).toUpperCase() + m.shift.slice(1) : "—",
        };
      }).sort((a, b) => b.sales - a.sales);

      const maxSales = Math.max(...rows.map(r => r.sales), 1);
      setCommissions(rows.map(r => ({ ...r, target: maxSales })));
    }).catch(e => toast({ title: "Could not load commissions", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
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
    }).catch(e => toast({ title: "Could not load messages", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
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
    }).catch(e => toast({ title: "Could not load staff tasks", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
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
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Staff Commissions & Chat</h1>
          <p className="text-xs text-muted-foreground">Performance tracking, tips and team communication</p>
        </div>
        {tab==="tasks"&&<button onClick={()=>setShowAddTask(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors"><Plus className="h-4 w-4"/>Add Task</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Team Sales",value:`₹${(totalSales/1000).toFixed(0)}K`,icon:TrendingUp,color:"text-primary",bg:"bg-primary/10"},
          {label:"Commissions",value:`₹${totalCommission.toLocaleString()}`,icon:DollarSign,color:"text-success",bg:"bg-success-subtle"},
          {label:"Total Tips",value:`₹${totalTips.toLocaleString()}`,icon:Wallet,color:"text-muted-foreground",bg:"bg-muted"},
          {label:"Avg Performance",value:avgRating > 0 ? avgRating.toFixed(1) : "—",icon:Star,color:"text-warning",bg:"bg-warning-subtle"},
        ].map(s=>(
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-xl font-semibold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["commissions","Commissions"],["chat","Team Chat"],["tasks","Task Board"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab===t?"bg-primary text-primary-foreground":"text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab==="commissions"&&(
        <div className="space-y-4">
          {commissions.length === 0 ? <EmptyState title="No commission data yet" /> : <>
          <div className="flex gap-2">
            {(["today","week","month"] as const).map(p=>(
              <button key={p} onClick={()=>setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${period===p?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{p==="today"?"Today":p==="week"?"This Week":"This Month"}</button>
            ))}
          </div>

          {/* Leaderboard */}
          <div className="bg-card border border-border rounded-lg p-4 mb-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-3 text-foreground"><Trophy className="h-4 w-4 text-warning" />Leaderboard</h3>
            <div className="space-y-2">
              {[...commissions].sort((a,b)=>b.sales-a.sales).map((s,i)=>(
                <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${i===0?"bg-primary/10 border border-primary/20":""}`}>
                  <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${i===0?"bg-primary text-primary-foreground":i===1?"bg-muted text-primary-foreground":i===2?"bg-primary text-foreground":"bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{s.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.name} <span className="text-muted-foreground font-normal text-xs">({s.role})</span></p>
                    <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{width:`${Math.min(100,(s.sales/Math.max(...commissions.map(c=>c.sales)))*100)}%`}}/>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary">₹{(s.sales/1000).toFixed(0)}K</p>
                    <p className="text-xs text-muted-foreground">{s.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detail Cards */}
          {commissions.map(staff=>{
            const targetPct = Math.min(100,Math.round((staff.sales/staff.target)*100));
            return (
              <div key={staff.id} className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-base font-semibold shrink-0">{staff.avatar}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{staff.name}</h3>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{staff.role}</span>
                      <span className="text-xs text-muted-foreground">{staff.shift}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {staff.rating > 0 ? (
                        <>
                          {[...Array(5)].map((_,i)=><Star key={i} className={`h-3.5 w-3.5 ${i<Math.floor(staff.rating)?"text-warning fill-warning":"text-muted-foreground"}`}/>)}
                          <span className="text-xs text-muted-foreground">{staff.rating.toFixed(1)}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No performance score</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-success">₹{(staff.commission+staff.tips).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">total earnings</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-4">
                  {[
                    {label:"Sales",value:`₹${(staff.sales/1000).toFixed(0)}K`,color:"text-primary"},
                    {label:"Commission",value:`₹${staff.commission}`,color:"text-success"},
                    {label:"Tips",value:`₹${staff.tips}`,color:"text-muted-foreground"},
                    {label:"Orders",value:staff.orders,color:"text-info"},
                  ].map(m=>(
                    <div key={m.label} className="bg-muted rounded-lg p-2 text-center">
                      <p className={`text-sm font-semibold ${m.color}`}>{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Monthly target</span>
                    <span className={`font-semibold ${targetPct>=100?"text-success":"text-primary"}`}>₹{(staff.sales/1000).toFixed(0)}K / ₹{(staff.target/1000).toFixed(0)}K ({targetPct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-colors ${targetPct>=100?"bg-success":"bg-primary"}`} style={{width:`${targetPct}%`}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </>}
        </div>
      )}

      {tab==="chat"&&(
        <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col" style={{height:"60vh"}}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse"/>
            <span className="text-sm font-semibold">Team Chat</span>
            <span className="text-xs text-muted-foreground">— {commissions.length} staff members</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? <EmptyState title="No team messages yet" /> : messages.map(m=>(
              <div key={m.id} className={`flex gap-3 ${m.role==="manager"||m.from==="You (Manager)"?"flex-row-reverse":""}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${m.role==="manager"?"bg-primary text-primary-foreground":m.role==="kitchen"?"bg-warning-subtle text-warning":m.role==="system"?"bg-danger-subtle text-danger":"bg-info-subtle text-info"}`}>
                  {m.from[0]}
                </div>
                <div className={`max-w-xs ${m.role==="manager"||m.from==="You (Manager)"?"items-end":""} flex flex-col`}>
                  <div className={`px-3 py-2 rounded-lg text-sm ${m.role==="manager"||m.from==="You (Manager)"?"bg-primary text-primary-foreground rounded-tr-sm":m.type==="alert"?"bg-danger-subtle border border-danger-border text-danger rounded-tl-sm":"bg-muted text-foreground rounded-tl-sm"}`}>
                    {m.body}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 px-1">
                    <span className="text-xs text-muted-foreground">{m.from}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{m.time}</span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={msgEndRef}/>
          </div>
          <div className="border-t border-border p-3 flex gap-2">
            <input value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendMessage()} placeholder="Type a message..." className="flex-1 bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
            <button onClick={sendMessage} disabled={!msg.trim()} className="h-10 w-10 rounded-lg bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-40 transition-colors">
              <Send className="h-4 w-4 text-primary-foreground"/>
            </button>
          </div>
        </div>
      )}

      {tab==="tasks"&&(
        <div className="space-y-3">
          {tasks.map(task=>(
            <div key={task.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <button onClick={()=>toggleTask(task)} className={`h-6 w-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${task.status==="completed"?"bg-success border-success-border":"border-border hover:border-border"}`}>
                  {task.status==="completed"&&<CheckSquare className="h-4 w-4 text-foreground"/>}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${task.status==="completed"?"line-through text-muted-foreground":"text-foreground"}`}>{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{task.assignedTo}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>Due: {task.dueBy}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${task.priority==="high"?"bg-warning-subtle text-warning":"bg-muted text-muted-foreground"}`}>{task.priority}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${task.status==="completed"?"bg-success-subtle text-success":task.status==="active"?"bg-info-subtle text-info":"bg-warning-subtle text-warning"}`}>{task.status}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {tasks.length===0&&<div className="text-center py-12 text-muted-foreground"><CheckSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground"/><p>No tasks yet</p></div>}
        </div>
      )}

      {showAddTask&&(
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Assign New Task</h2>
              <button onClick={()=>setShowAddTask(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground"/></button>
            </div>
            <div className="space-y-4">
              {[
                {label:"Task",key:"title",placeholder:"What needs to be done?"},
                {label:"Assigned To",key:"assignedTo",placeholder:"Staff name or role"},
                {label:"Due By",key:"dueBy",placeholder:"e.g. End of shift, 6 PM"},
              ].map(f=>(
                <div key={f.key}><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">{f.label}</label>
                  <input value={(newTask as any)[f.key]} onChange={e=>setNewTask(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"/>
                </div>
              ))}
              <div><label className="text-xs text-muted-foreground mb-1.5 block uppercase tracking-wide">Priority</label>
                <div className="flex gap-2">
                  {["normal","high"].map(p=><button key={p} onClick={()=>setNewTask(pr=>({...pr,priority:p}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-colors ${newTask.priority===p?"bg-primary/20 border-primary/40 text-primary":"border-border bg-muted text-muted-foreground"}`}>{p}</button>)}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setShowAddTask(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={submitTask} disabled={!newTask.title} className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm disabled:opacity-40">Assign Task</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
