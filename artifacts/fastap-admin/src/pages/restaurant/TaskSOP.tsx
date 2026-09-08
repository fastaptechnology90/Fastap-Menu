import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { CheckSquare, Plus, X, Clock, CheckCircle, Users, FileText, PlayCircle, Download, Eye, Edit2, Trash2 } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { tasksSop as tasksApi } from "@/lib/api";
import { EmptyState } from "@/components/restaurant/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import type { ChecklistItem, SopDoc, TrainingVideo } from "@/lib/restaurant-types";

type Tab = "checklist" | "sop" | "training" | "tasks";

type TaskRow = { id: string; title: string; assignedTo: string; dueDate: string; priority: string; status: string; notes: string };

function mapTaskRow(t: any): TaskRow {
  return {
    id: String(t.id),
    title: t.title || t.name || "Task",
    assignedTo: t.assignedTo || t.assignee || "Unassigned",
    dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—",
    priority: t.priority || "normal",
    status: t.status || "pending",
    notes: t.description || t.notes || "",
  };
}

export default function TaskSOP() {
  const { restaurantId, staffList } = useRestaurant();
  const { confirm, confirmDialog } = useConfirm();
  const [tab, setTab] = useState<Tab>("checklist");
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [showAddSop, setShowAddSop] = useState(false);
  const [editSop, setEditSop] = useState<any | null>(null);
  const [sopForm, setSopForm] = useState({ title: "", category: "service", content: "", steps: "" });
  const [checklistType, setChecklistType] = useState<"opening" | "closing">("opening");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [checklists, setChecklists] = useState<{ opening: ChecklistItem[]; closing: ChecklistItem[] }>({ opening: [], closing: [] });
  const [sopCat, setSopCat] = useState("all");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", assignedTo: "", dueDate: "", priority: "normal", notes: "" });
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [sopDocs, setSopDocs] = useState<SopDoc[]>([]);
  const [sopRaw, setSopRaw] = useState<Record<string, any>>({});
  const [viewSop, setViewSop] = useState<any | null>(null);
  const [trainingVideos, setTrainingVideos] = useState<TrainingVideo[]>([]);
  const [loadingVideo, setLoadingVideo] = useState<string | null>(null);

  // "Read by staff" used to be invented from the number of steps in the document — a
  // number no one had recorded, shown as if it were a real acknowledgement count. There
  // is no read-receipt table behind it, so the card now reports only what is known.
  const applySops = useCallback((sopRows: any[]) => {
    setSopRaw(Object.fromEntries(sopRows.map((s: any) => [String(s.id), s])));
    setSopDocs(sopRows.map((s: any) => ({
      id: String(s.id),
      title: s.title,
      category: s.category || "service",
      version: "v1.0",
      updatedAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
      mandatory: s.isActive !== false,
      readBy: 0,
      totalStaff: Math.max(staffList.length, 1),
      pages: Math.max(1, Math.ceil((s.content?.length ?? 100) / 500)),
    })));
  }, [staffList.length]);

  const reloadTasks = useCallback(async () => {
    if (!restaurantId) return;
    const rows = await tasksApi.tasks(restaurantId);
    if (Array.isArray(rows)) setTasks(rows.map(mapTaskRow));
  }, [restaurantId]);

  const reloadSops = useCallback(async () => {
    if (!restaurantId) return;
    const rows = await tasksApi.sopList(restaurantId);
    if (Array.isArray(rows)) applySops(rows);
  }, [restaurantId, applySops]);

  const persistProgress = useCallback(async (type: "opening" | "closing", ids: string[]) => {
    if (!restaurantId) return;
    try {
      await tasksApi.saveChecklistProgress(restaurantId, type, ids);
    } catch (e) {
      // A tick that never reached the server would otherwise look done to the
      // next shift, who would skip the task.
      toast({ title: "Checklist not saved", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      tasksApi.tasks(restaurantId).catch(() => []),
      tasksApi.sopList(restaurantId).catch(() => []),
      tasksApi.trainingVideos(restaurantId).catch(() => []),
      tasksApi.checklists(restaurantId).catch(() => null),
    ]).then(([taskRows, sopRows, videos, checklistData]) => {
      if (Array.isArray(taskRows)) setTasks(taskRows.map(mapTaskRow));
      if (Array.isArray(sopRows)) applySops(sopRows);
      if (Array.isArray(videos)) setTrainingVideos(videos);
      if (checklistData?.templates) {
        setChecklists({
          opening: checklistData.templates.opening ?? [],
          closing: checklistData.templates.closing ?? [],
        });
        const prog = checklistData.progress?.[checklistType] ?? [];
        setChecked(new Set(prog));
      }
    });
  }, [restaurantId, staffList.length]);

  useEffect(() => {
    if (!restaurantId) return;
    tasksApi.checklists(restaurantId).then(data => {
      const prog = data?.progress?.[checklistType] ?? [];
      setChecked(new Set(prog));
    }).catch(e => toast({ title: "Could not load today's checklist progress", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" }));
  }, [restaurantId, checklistType]);

  async function toggleTaskStatus(task: TaskRow) {
    if (!restaurantId) return;
    const next = task.status === "completed" ? "pending" : "completed";
    try {
      await tasksApi.updateTask(restaurantId, parseInt(task.id, 10), { status: next });
      // Only move the row once the server agrees, so a failed write cannot leave
      // a task showing as done.
      setTasks(t => t.map(x => x.id === task.id ? { ...x, status: next } : x));
    } catch (e) {
      toast({ title: "Could not update the task", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleAddTask() {
    if (!restaurantId) return;
    // A blank title used to close nothing and say nothing — the button simply did not work.
    if (!newTask.title.trim()) {
      toast({ title: "Give the task a title", description: "Staff need to know what to do.", variant: "destructive" });
      return;
    }
    try {
      await tasksApi.createTask(restaurantId, {
        title: newTask.title,
        assignedTo: newTask.assignedTo,
        dueDate: newTask.dueDate || undefined,
        priority: newTask.priority,
        description: newTask.notes,
      });
      await reloadTasks();
      setNewTask({ title: "", assignedTo: "", dueDate: "", priority: "normal", notes: "" });
      setShowAddTask(false);
      toast({ title: "Task created" });
    } catch (e) {
      // Keep the dialog and its contents so the user can correct and retry.
      toast({ title: "Task not created", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleSaveTask() {
    if (!editTask || !restaurantId) return;
    if (!editTask.title.trim()) {
      toast({ title: "Title cannot be blank", variant: "destructive" });
      return;
    }
    try {
      await tasksApi.updateTask(restaurantId, parseInt(editTask.id, 10), {
        title: editTask.title,
        assignedTo: editTask.assignedTo,
        priority: editTask.priority,
        description: editTask.notes,
        status: editTask.status,
      });
      await reloadTasks();
      setEditTask(null);
      toast({ title: "Task updated" });
    } catch (e) {
      toast({ title: "Could not save the task", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleDeleteTask(task: TaskRow) {
    if (!restaurantId) return;
    const ok = await confirm({
      title: "Delete this task?",
      description: task.title,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await tasksApi.deleteTask(restaurantId, parseInt(task.id, 10));
      await reloadTasks();
      toast({ title: "Task deleted" });
    } catch (e) {
      toast({ title: "Could not delete the task", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleSaveSop() {
    if (!restaurantId) return;
    if (!sopForm.title.trim()) {
      toast({ title: "Give the document a title", variant: "destructive" });
      return;
    }
    // Steps are typed one per line, which is how the viewer and the download render them.
    const steps = sopForm.steps.split("\n").map(s => s.trim()).filter(Boolean);
    const body = { title: sopForm.title, category: sopForm.category, content: sopForm.content, steps };
    try {
      if (editSop) await tasksApi.updateSop(restaurantId, parseInt(String(editSop.id), 10), body);
      else await tasksApi.createSop(restaurantId, body);
      await reloadSops();
      setShowAddSop(false);
      setEditSop(null);
      setSopForm({ title: "", category: "service", content: "", steps: "" });
      toast({ title: editSop ? "Document updated" : "Document added" });
    } catch (e) {
      toast({ title: "Could not save the document", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleDeleteSop(doc: SopDoc) {
    if (!restaurantId) return;
    const ok = await confirm({
      title: "Delete this document?",
      description: `${doc.title} will no longer be available to staff.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await tasksApi.deleteSop(restaurantId, parseInt(doc.id, 10));
      await reloadSops();
      toast({ title: "Document deleted" });
    } catch (e) {
      toast({ title: "Could not delete the document", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  const template = checklists[checklistType] ?? [];
  const done = template.filter(t => checked.has(t.id)).length;
  const mandatory = template.filter(t => t.mandatory);
  const mandatoryDone = mandatory.filter(t => checked.has(t.id)).length;
  const trainingCompletions = trainingVideos.reduce((s, v) => s + v.completions, 0);

  function toggleCheck(id: string) {
    setChecked(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      persistProgress(checklistType, [...n]);
      return n;
    });
  }

  function resetChecklist() {
    setChecked(new Set());
    persistProgress(checklistType, []);
  }

  async function downloadSop(docId: string) {
    if (!restaurantId) return;
    try {
      await tasksApi.downloadSop(restaurantId, parseInt(docId, 10));
    } catch (e) {
      toast({ title: "Download failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function watchVideo(video: TrainingVideo) {
    if (!restaurantId) return;
    setLoadingVideo(video.id);
    try {
      const updated = await tasksApi.recordVideoView(restaurantId, video.id);
      setTrainingVideos(v => v.map(x => x.id === video.id ? { ...x, ...updated } : x));
      if (video.videoUrl) window.open(video.videoUrl, "_blank", "noopener,noreferrer");
      else toast({ title: "No video link on this item", description: "Add a video URL before staff can watch it.", variant: "destructive" });
    } catch (e) {
      toast({ title: "Could not open the video", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoadingVideo(null);
    }
  }

  async function markVideoComplete(video: TrainingVideo) {
    if (!restaurantId) return;
    try {
      const updated = await tasksApi.completeVideo(restaurantId, video.id);
      setTrainingVideos(v => v.map(x => x.id === video.id ? { ...x, ...updated } : x));
      toast({ title: `${video.title} marked complete` });
    } catch (e) {
      toast({ title: "Could not record completion", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  const staffOptions = staffList.length
    ? staffList.map(s => s.name)
    : ["Manager", "Chef", "Cashier", "Waiter"];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Tasks & SOP</h1>
          <p className="text-xs text-white/40">Checklists, standard procedures and staff training</p>
        </div>
        {tab === "tasks" && (
          <button onClick={() => setShowAddTask(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
            <Plus className="h-4 w-4" />Add Task
          </button>
        )}
        {/* The SOP tab listed documents and offered no way to add one — the only route in
            was seeding the table by hand. */}
        {tab === "sop" && (
          <button onClick={() => { setEditSop(null); setSopForm({ title: "", category: "service", content: "", steps: "" }); setShowAddSop(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 transition-all">
            <Plus className="h-4 w-4" />New Document
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Checklist", value: template.length ? `${done}/${template.length}` : "—", color: done === template.length && template.length ? "text-emerald-400" : "text-amber-400", bg: done === template.length && template.length ? "bg-emerald-500/10" : "bg-amber-500/10" },
          { label: "Pending Tasks", value: tasks.filter(t => t.status !== "completed").length, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "SOP Documents", value: sopDocs.length, color: "text-violet-400", bg: "bg-violet-500/10" },
          { label: "Training Completions", value: trainingCompletions, color: "text-teal-400", bg: "bg-teal-500/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["checklist", "Daily Checklist"], ["tasks", "Task Board"], ["sop", "SOP Documents"], ["training", "Training Videos"]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-amber-500 text-black" : "text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab === "checklist" && (
        <div className="space-y-4">
          {template.length === 0 ? <EmptyState title="No checklist templates" /> : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(["opening", "closing"] as const).map(t => (
                    <button key={t} onClick={() => setChecklistType(t)} className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize border transition-all ${checklistType === t ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                      {t === "opening" ? "🌅 Opening" : "🌙 Closing"} Checklist
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className={`font-extrabold ${mandatoryDone === mandatory.length ? "text-emerald-400" : "text-amber-400"}`}>{mandatoryDone}/{mandatory.length}</span>
                    <span className="text-white/40"> mandatory</span>
                  </div>
                  <button onClick={resetChecklist} className="text-xs text-white/40 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5">Reset</button>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/50">{checklistType} checklist progress</span>
                  <span className={`font-bold ${done === template.length ? "text-emerald-400" : "text-amber-400"}`}>{done}/{template.length} done</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${done === template.length ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${template.length ? (done / template.length) * 100 : 0}%` }} />
                </div>
              </div>
              {["manager", "cashier", "kitchen", "waiter", "housekeeping"].map(role => {
                const roleTasks = template.filter(t => t.role === role);
                if (!roleTasks.length) return null;
                return (
                  <div key={role}>
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2 capitalize">{role}</p>
                    <div className="space-y-1.5">
                      {roleTasks.map(t => {
                        const isChecked = checked.has(t.id);
                        return (
                          <button key={t.id} onClick={() => toggleCheck(t.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isChecked ? "border-emerald-500/30 bg-emerald-500/8" : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${isChecked ? "bg-emerald-500 border-emerald-500" : "border-white/20"}`}>
                              {isChecked && <CheckCircle className="h-3 w-3 text-white" />}
                            </div>
                            <span className={`text-sm flex-1 ${isChecked ? "text-white/40 line-through" : "text-white/80"}`}>{t.task}</span>
                            {t.mandatory && !isChecked && <span className="text-xs text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded-md shrink-0">Required</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {tab === "tasks" && (
        <div className="space-y-3">
          {tasks.length === 0 ? <EmptyState title="No tasks" description="Add operational tasks for your team." /> : tasks.map(task => (
            <div key={task.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <button onClick={() => toggleTaskStatus(task)} className={`h-6 w-6 rounded-md flex items-center justify-center border shrink-0 mt-0.5 transition-all ${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-white/25 hover:border-white/50"}`}>
                  {task.status === "completed" && <CheckCircle className="h-4 w-4 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${task.status === "completed" ? "text-white/40 line-through" : "text-white"}`}>{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-white/40 flex-wrap">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{task.assignedTo}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Due: {task.dueDate}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${task.priority === "high" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white/40"}`}>{task.priority}</span>
                  </div>
                  {task.notes && <p className="text-xs text-white/30 mt-1">📝 {task.notes}</p>}
                </div>
                {/* A task could be created and ticked off but never corrected or removed. */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setEditTask({ ...task })} aria-label={`Edit ${task.title}`} className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30">
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDeleteTask(task)} aria-label={`Delete ${task.title}`} className="h-7 w-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "sop" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {["all", "safety", "service", "finance", "hr", "compliance"].map(c => (
              <button key={c} onClick={() => setSopCat(c)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${sopCat === c ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/10 bg-white/5 text-white/40"}`}>{c === "all" ? "All Categories" : c}</button>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {sopDocs.filter(d => sopCat === "all" || d.category === sopCat).length === 0 ? <EmptyState title="No SOP documents" description="Use New Document to write one." /> : sopDocs.filter(d => sopCat === "all" || d.category === sopCat).map(doc => {
              return (
                <div key={doc.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0"><FileText className="h-5 w-5 text-violet-400" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold">{doc.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                        <span className="capitalize">{doc.category}</span>·<span>{doc.version}</span>·<span>{doc.pages} pages</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${doc.mandatory ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"}`}>
                      {doc.mandatory ? "Active" : "Archived"}
                    </span>
                    <span className="text-white/30">Updated {doc.updatedAt}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewSop({ ...doc, ...(sopRaw[doc.id] ?? {}) })} className="flex-1 py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold hover:bg-violet-500/20 flex items-center justify-center gap-1">
                      <Eye className="h-3.5 w-3.5" />View
                    </button>
                    <button onClick={() => downloadSop(doc.id)} className="flex-1 py-2 rounded-xl border border-white/10 bg-white/5 text-white/50 text-xs font-semibold hover:bg-white/10 flex items-center justify-center gap-1">
                      <Download className="h-3.5 w-3.5" />Download
                    </button>
                    <button
                      onClick={() => {
                        const raw = sopRaw[doc.id] ?? {};
                        setEditSop(raw);
                        setSopForm({
                          title: raw.title ?? doc.title,
                          category: raw.category ?? doc.category,
                          content: raw.content ?? "",
                          steps: Array.isArray(raw.steps) ? raw.steps.map((s: any) => typeof s === "string" ? s : (s?.text ?? s?.title ?? "")).join("\n") : "",
                        });
                        setShowAddSop(true);
                      }}
                      aria-label={`Edit ${doc.title}`}
                      className="px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteSop(doc)} aria-label={`Delete ${doc.title}`} className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "training" && (
        <div className="grid lg:grid-cols-2 gap-4">
          {trainingVideos.length === 0 ? <EmptyState title="No training videos" /> : trainingVideos.map(video => {
            const completePct = video.views ? Math.round((video.completions / video.views) * 100) : 0;
            return (
              <div key={video.id} className="bg-[#0e1520] border border-white/5 rounded-2xl overflow-hidden">
                <div className="bg-white/[0.03] border-b border-white/5 p-4 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-amber-500/15 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">{video.thumbnail}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{video.title}</p>
                    <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{video.duration}</span>
                      <span className="capitalize">{video.category}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-white/40">{video.completions}/{video.views} staff completed</span>
                    <span className="font-bold text-amber-400">{completePct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 mb-3 overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: `${completePct}%` }} /></div>
                  <div className="flex gap-2">
                    <button onClick={() => watchVideo(video)} disabled={loadingVideo === video.id} className="flex-1 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold hover:bg-amber-500/30 flex items-center justify-center gap-2">
                      <PlayCircle className="h-4 w-4" />{loadingVideo === video.id ? "Opening…" : "Watch"}
                    </button>
                    <button onClick={() => markVideoComplete(video)} className="px-3 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold">Mark Done</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewSop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewSop(null)}>
          <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0"><FileText className="h-5 w-5 text-violet-400" /></div>
                <div className="min-w-0">
                  <h2 className="font-bold text-sm truncate">{viewSop.title}</h2>
                  <p className="text-xs text-white/40 capitalize mt-0.5">{viewSop.category} · {viewSop.version ?? "v1.0"} · {viewSop.pages ?? 1} pages</p>
                </div>
              </div>
              <button onClick={() => setViewSop(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 overflow-y-auto text-sm text-white/80 space-y-3">
              {Array.isArray(viewSop.steps) && viewSop.steps.length > 0 ? (
                <ol className="space-y-2 list-decimal list-inside">
                  {viewSop.steps.map((step: any, i: number) => (
                    <li key={i} className="text-white/75">{typeof step === "string" ? step : (step?.text ?? step?.title ?? JSON.stringify(step))}</li>
                  ))}
                </ol>
              ) : viewSop.content ? (
                <p className="whitespace-pre-wrap text-white/75 leading-relaxed">{viewSop.content}</p>
              ) : (
                <p className="text-white/40 italic">No preview content available for this document. Use Download to get the full file.</p>
              )}
            </div>
            <div className="p-4 border-t border-white/10">
              <button onClick={() => { downloadSop(String(viewSop.id)); }} className="w-full py-2.5 rounded-xl bg-amber-500 text-black text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-400">
                <Download className="h-4 w-4" />Download
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">New Task</h2>
              <button onClick={() => setShowAddTask(false)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="space-y-4">
              <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40" />
              <select value={newTask.assignedTo} onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                <option value="">-- Select Staff --</option>
                {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              {/* Priority was posted to the server but had no control, so every task was
                  created "normal" and the urgent badge could never be set. */}
              <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                {["low", "normal", "high"].map(p => <option key={p} value={p}>{p} priority</option>)}
              </select>
              <textarea value={newTask.notes} onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notes" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddTask(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={handleAddTask} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm">Add Task</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">Edit Task</h2>
              <button onClick={() => setEditTask(null)} aria-label="Close"><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="space-y-4">
              <input value={editTask.title} onChange={e => setEditTask({ ...editTask, title: e.target.value })} placeholder="Task title" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40" />
              <select value={editTask.assignedTo} onChange={e => setEditTask({ ...editTask, assignedTo: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                <option value="">-- Select Staff --</option>
                {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={editTask.priority} onChange={e => setEditTask({ ...editTask, priority: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                {["low", "normal", "high"].map(p => <option key={p} value={p}>{p} priority</option>)}
              </select>
              <textarea value={editTask.notes} onChange={e => setEditTask({ ...editTask, notes: e.target.value })} rows={2} placeholder="Notes" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none" />
              <div className="flex gap-3">
                <button onClick={() => setEditTask(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={handleSaveTask} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddSop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold">{editSop ? "Edit Document" : "New SOP Document"}</h2>
              <button onClick={() => { setShowAddSop(false); setEditSop(null); }} aria-label="Close"><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="space-y-4">
              <input value={sopForm.title} onChange={e => setSopForm(p => ({ ...p, title: e.target.value }))} placeholder="Document title" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40" />
              <select value={sopForm.category} onChange={e => setSopForm(p => ({ ...p, category: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                {["safety", "service", "kitchen", "finance", "hr", "compliance"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Summary</label>
                <textarea value={sopForm.content} onChange={e => setSopForm(p => ({ ...p, content: e.target.value }))} rows={3} placeholder="What this procedure covers" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Steps — one per line</label>
                <textarea value={sopForm.steps} onChange={e => setSopForm(p => ({ ...p, steps: e.target.value }))} rows={6} placeholder={"Wash hands\nCheck fridge temperature\nRecord the reading"} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none font-mono" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowAddSop(false); setEditSop(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={handleSaveSop} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm">{editSop ? "Save Changes" : "Add Document"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
