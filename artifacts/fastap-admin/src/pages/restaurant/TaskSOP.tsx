import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { CheckSquare, Plus, X, Clock, CheckCircle, Users, FileText, PlayCircle, Download, Eye, Edit2, Trash2, StickyNote } from "lucide-react";
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
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const persistProgress = useCallback(async (type: "opening" | "closing", ids: string[], previous: Set<string>) => {
    if (!restaurantId) return;
    try {
      await tasksApi.saveChecklistProgress(restaurantId, type, ids);
    } catch (e) {
      // A tick that never reached the server would otherwise look done to the
      // next shift, who would skip the task. Roll the UI back to the last known set.
      setChecked(new Set(previous));
      toast({ title: "Checklist not saved", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoadError(null);
    Promise.all([
      tasksApi.tasks(restaurantId),
      tasksApi.sopList(restaurantId),
      tasksApi.trainingVideos(restaurantId),
      tasksApi.checklists(restaurantId),
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
    }).catch(e => {
      // Swallowing each call as [] made a 500 look like an empty shift board.
      const msg = e instanceof Error ? e.message : "Could not load tasks and SOPs.";
      setLoadError(msg);
      toast({ title: "Could not load Tasks & SOPs", description: msg, variant: "destructive" });
    });
  }, [restaurantId, staffList.length, applySops]);

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
      void persistProgress(checklistType, [...n], prev);
      return n;
    });
  }

  function resetChecklist() {
    setChecked(prev => {
      void persistProgress(checklistType, [], prev);
      return new Set();
    });
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
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Tasks & SOP</h1>
          <p className="text-xs text-muted-foreground">Checklists, standard procedures and staff training</p>
        </div>
        {tab === "tasks" && (
          <button onClick={() => setShowAddTask(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors">
            <Plus className="h-4 w-4" />Add Task
          </button>
        )}
        {/* The SOP tab listed documents and offered no way to add one — the only route in
            was seeding the table by hand. */}
        {tab === "sop" && (
          <button onClick={() => { setEditSop(null); setSopForm({ title: "", category: "service", content: "", steps: "" }); setShowAddSop(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold shadow-sm transition-colors">
            <Plus className="h-4 w-4" />New Document
          </button>
        )}
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-danger bg-danger-subtle border border-danger-border rounded-lg px-3 py-2">{loadError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Checklist", value: template.length ? `${done}/${template.length}` : "—", color: done === template.length && template.length ? "text-success" : "text-primary", bg: done === template.length && template.length ? "bg-success-subtle" : "bg-primary/10" },
          { label: "Pending Tasks", value: tasks.filter(t => t.status !== "completed").length, color: "text-info", bg: "bg-info-subtle" },
          { label: "SOP Documents", value: sopDocs.length, color: "text-muted-foreground", bg: "bg-muted" },
          { label: "Training Completions", value: trainingCompletions, color: "text-success", bg: "bg-success-subtle" },
        ].map(s => (
          <div key={s.label} className={`rounded-lg ${s.bg} border border-border p-4`}>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {([["checklist", "Daily Checklist"], ["tasks", "Task Board"], ["sop", "SOP Documents"], ["training", "Training Videos"]] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "checklist" && (
        <div className="space-y-4">
          {template.length === 0 ? <EmptyState title="No checklist templates" /> : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(["opening", "closing"] as const).map(t => (
                    <button key={t} onClick={() => setChecklistType(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize border transition-colors ${checklistType === t ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                      {t === "opening" ? "Opening" : "Closing"} Checklist
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className={`font-semibold ${mandatoryDone === mandatory.length ? "text-success" : "text-primary"}`}>{mandatoryDone}/{mandatory.length}</span>
                    <span className="text-muted-foreground"> mandatory</span>
                  </div>
                  <button onClick={resetChecklist} className="text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted">Reset</button>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">{checklistType} checklist progress</span>
                  <span className={`font-semibold ${done === template.length ? "text-success" : "text-primary"}`}>{done}/{template.length} done</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-colors ${done === template.length ? "bg-success" : "bg-primary"}`} style={{ width: `${template.length ? (done / template.length) * 100 : 0}%` }} />
                </div>
              </div>
              {["manager", "cashier", "kitchen", "waiter", "housekeeping"].map(role => {
                const roleTasks = template.filter(t => t.role === role);
                if (!roleTasks.length) return null;
                return (
                  <div key={role}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 capitalize">{role}</p>
                    <div className="space-y-1.5">
                      {roleTasks.map(t => {
                        const isChecked = checked.has(t.id);
                        return (
                          <button key={t.id} onClick={() => toggleCheck(t.id)} className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${isChecked ? "border-success-border bg-success-subtle" : "border-border bg-card hover:border-border"}`}>
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${isChecked ? "bg-success border-success-border" : "border-border"}`}>
                              {isChecked && <CheckCircle className="h-3 w-3 text-foreground" />}
                            </div>
                            <span className={`text-sm flex-1 ${isChecked ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.task}</span>
                            {t.mandatory && !isChecked && <span className="text-xs text-danger border border-danger-border px-1.5 py-0.5 rounded-md shrink-0">Required</span>}
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
            <div key={task.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <button onClick={() => toggleTaskStatus(task)} className={`h-6 w-6 rounded-md flex items-center justify-center border shrink-0 mt-0.5 transition-colors ${task.status === "completed" ? "bg-success border-success-border" : "border-border hover:border-border"}`}>
                  {task.status === "completed" && <CheckCircle className="h-4 w-4 text-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${task.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}`}>{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{task.assignedTo}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Due: {task.dueDate}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${task.priority === "high" ? "bg-danger-subtle text-danger" : "bg-muted text-muted-foreground"}`}>{task.priority}</span>
                  </div>
                  {task.notes && <p className="text-xs text-muted-foreground mt-1"><StickyNote className="h-3 w-3 inline mb-0.5" /> {task.notes}</p>}
                </div>
                {/* A task could be created and ticked off but never corrected or removed. */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setEditTask({ ...task })} aria-label={`Edit ${task.title}`} className="h-7 w-7 rounded-lg bg-info-subtle text-info flex items-center justify-center hover-elevate">
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDeleteTask(task)} aria-label={`Delete ${task.title}`} className="h-7 w-7 rounded-lg bg-danger-subtle text-danger flex items-center justify-center hover-elevate">
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
              <button key={c} onClick={() => setSopCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${sopCat === c ? "bg-primary/20 border-primary/40 text-primary" : "border-border bg-muted text-muted-foreground"}`}>{c === "all" ? "All Categories" : c}</button>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {sopDocs.filter(d => sopCat === "all" || d.category === sopCat).length === 0 ? <EmptyState title="No SOP documents" description="Use New Document to write one." /> : sopDocs.filter(d => sopCat === "all" || d.category === sopCat).map(doc => {
              return (
                <div key={doc.id} className="bg-card border border-border rounded-lg p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><FileText className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold">{doc.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="capitalize">{doc.category}</span>·<span>{doc.version}</span>·<span>{doc.pages} pages</span>
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${doc.mandatory ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground"}`}>
                      {doc.mandatory ? "Active" : "Archived"}
                    </span>
                    <span className="text-muted-foreground">Updated {doc.updatedAt}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewSop({ ...doc, ...(sopRaw[doc.id] ?? {}) })} className="flex-1 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-semibold hover-elevate flex items-center justify-center gap-1">
                      <Eye className="h-3.5 w-3.5" />View
                    </button>
                    <button onClick={() => downloadSop(doc.id)} className="flex-1 py-2 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-semibold hover-elevate flex items-center justify-center gap-1">
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
                      className="px-3 py-2 rounded-lg border border-info-border bg-info-subtle text-info hover-elevate"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteSop(doc)} aria-label={`Delete ${doc.title}`} className="px-3 py-2 rounded-lg border border-danger-border bg-danger-subtle text-danger hover-elevate">
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
              <div key={video.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="bg-card border-b border-border p-4 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary shrink-0">{video.thumbnail}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{video.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{video.duration}</span>
                      <span className="capitalize">{video.category}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">{video.completions}/{video.views} staff completed</span>
                    <span className="font-semibold text-primary">{completePct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted mb-3 overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${completePct}%` }} /></div>
                  <div className="flex gap-2">
                    <button onClick={() => watchVideo(video)} disabled={loadingVideo === video.id} className="flex-1 py-2.5 rounded-lg bg-primary/20 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/30 flex items-center justify-center gap-2">
                      <PlayCircle className="h-4 w-4" />{loadingVideo === video.id ? "Opening…" : "Watch"}
                    </button>
                    <button onClick={() => markVideoComplete(video)} className="px-3 py-2.5 rounded-lg border border-success-border bg-success-subtle text-success text-xs font-semibold">Mark Done</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewSop && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewSop(null)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><FileText className="h-5 w-5 text-muted-foreground" /></div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-sm truncate">{viewSop.title}</h2>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{viewSop.category} · {viewSop.version ?? "v1.0"} · {viewSop.pages ?? 1} pages</p>
                </div>
              </div>
              <button onClick={() => setViewSop(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-5 overflow-y-auto text-sm text-foreground space-y-3">
              {Array.isArray(viewSop.steps) && viewSop.steps.length > 0 ? (
                <ol className="space-y-2 list-decimal list-inside">
                  {viewSop.steps.map((step: any, i: number) => (
                    <li key={i} className="text-foreground">{typeof step === "string" ? step : (step?.text ?? step?.title ?? JSON.stringify(step))}</li>
                  ))}
                </ol>
              ) : viewSop.content ? (
                <p className="whitespace-pre-wrap text-foreground leading-relaxed">{viewSop.content}</p>
              ) : (
                <p className="text-muted-foreground italic">No preview content available for this document. Use Download to get the full file.</p>
              )}
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => { downloadSop(String(viewSop.id)); }} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90">
                <Download className="h-4 w-4" />Download
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddTask && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">New Task</h2>
              <button onClick={() => setShowAddTask(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="space-y-4">
              <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40" />
              <select value={newTask.assignedTo} onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                <option value="">-- Select Staff --</option>
                {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground" />
              {/* Priority was posted to the server but had no control, so every task was
                  created "normal" and the urgent badge could never be set. */}
              <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                {["low", "normal", "high"].map(p => <option key={p} value={p}>{p} priority</option>)}
              </select>
              <textarea value={newTask.notes} onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notes" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm resize-none" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddTask(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={handleAddTask} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm">Add Task</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editTask && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">Edit Task</h2>
              <button onClick={() => setEditTask(null)} aria-label="Close"><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="space-y-4">
              <input value={editTask.title} onChange={e => setEditTask({ ...editTask, title: e.target.value })} placeholder="Task title" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40" />
              <select value={editTask.assignedTo} onChange={e => setEditTask({ ...editTask, assignedTo: e.target.value })} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                <option value="">-- Select Staff --</option>
                {staffOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={editTask.priority} onChange={e => setEditTask({ ...editTask, priority: e.target.value })} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                {["low", "normal", "high"].map(p => <option key={p} value={p}>{p} priority</option>)}
              </select>
              <textarea value={editTask.notes} onChange={e => setEditTask({ ...editTask, notes: e.target.value })} rows={2} placeholder="Notes" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm resize-none" />
              <div className="flex gap-3">
                <button onClick={() => setEditTask(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={handleSaveTask} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddSop && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold">{editSop ? "Edit Document" : "New SOP Document"}</h2>
              <button onClick={() => { setShowAddSop(false); setEditSop(null); }} aria-label="Close"><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="space-y-4">
              <input value={sopForm.title} onChange={e => setSopForm(p => ({ ...p, title: e.target.value }))} placeholder="Document title" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40" />
              <select value={sopForm.category} onChange={e => setSopForm(p => ({ ...p, category: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                {["safety", "service", "kitchen", "finance", "hr", "compliance"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Summary</label>
                <textarea value={sopForm.content} onChange={e => setSopForm(p => ({ ...p, content: e.target.value }))} rows={3} placeholder="What this procedure covers" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Steps — one per line</label>
                <textarea value={sopForm.steps} onChange={e => setSopForm(p => ({ ...p, steps: e.target.value }))} rows={6} placeholder={"Wash hands\nCheck fridge temperature\nRecord the reading"} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm resize-none font-mono" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowAddSop(false); setEditSop(null); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold">Cancel</button>
                <button onClick={handleSaveSop} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm">{editSop ? "Save Changes" : "Add Document"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
