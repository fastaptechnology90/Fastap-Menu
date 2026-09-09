import { useState, useEffect, useCallback } from "react";
import { FileText, Monitor, Printer, Tablet, Cpu, Upload, Download, CheckCircle, AlertTriangle, Clock, Battery, Loader, Eye, X, Plus, Edit2, Trash2, RefreshCw } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { documentsApi, hardwareApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";

type Tab = "documents" | "hardware";

type DocRow = {
  id: string; name: string; category: string; status: string; expiry: string; size: string; uploadedOn: string; fileType: string; fileUrl: string;
};

type HwRow = {
  id: string; name: string; type: string; location: string; status: string; battery: number | null; lastSeen: string; assignedTo: string; serialNo: string;
  model: string; cost: number; purchasedOn: string;
};

const BLANK_HW = { id: "", name: "", type: "pos", location: "", status: "online", assignedTo: "", serialNo: "", model: "", cost: 0, purchasedOn: "" };

const DOC_STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  active: { label: "Valid", color: "text-success", bg: "bg-success-subtle", icon: CheckCircle },
  valid: { label: "Valid", color: "text-success", bg: "bg-success-subtle", icon: CheckCircle },
  pending_renewal: { label: "Expiring", color: "text-warning", bg: "bg-warning-subtle", icon: Clock },
  expiring: { label: "Expiring", color: "text-warning", bg: "bg-warning-subtle", icon: Clock },
  expired: { label: "Expired", color: "text-danger", bg: "bg-danger-subtle", icon: AlertTriangle },
};

const HW_TYPE_CFG: Record<string, { label: string; icon: typeof Tablet; color: string; bg: string }> = {
  pos: { label: "POS Terminal", icon: Tablet, color: "text-info", bg: "bg-info-subtle" },
  kds: { label: "KDS Display", icon: Monitor, color: "text-muted-foreground", bg: "bg-muted" },
  display: { label: "Display", icon: Monitor, color: "text-muted-foreground", bg: "bg-muted" },
  printer: { label: "Printer", icon: Printer, color: "text-primary", bg: "bg-primary/15" },
  desktop: { label: "Desktop", icon: Cpu, color: "text-success", bg: "bg-success-subtle" },
  nfc: { label: "NFC Reader", icon: Monitor, color: "text-muted-foreground", bg: "bg-muted" },
  tablet: { label: "Tablet", icon: Tablet, color: "text-info", bg: "bg-info-subtle" },
  kiosk: { label: "Kiosk", icon: Monitor, color: "text-warning", bg: "bg-warning-subtle" },
  scanner: { label: "Scanner", icon: Cpu, color: "text-warning", bg: "bg-warning-subtle" },
};

const HW_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  online: { label: "Marked in service", color: "text-success", bg: "bg-success-subtle" },
  offline: { label: "Marked out of service", color: "text-danger", bg: "bg-danger-subtle" },
  "low-battery": { label: "Low battery", color: "text-warning", bg: "bg-warning-subtle" },
};

const CAT_COLOR: Record<string, string> = {
  License: "text-info", GST: "text-success", Safety: "text-warning", Agreement: "text-muted-foreground", license: "text-info",
};

function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mapDoc(row: any): DocRow {
  const status = row.status === "active" ? "valid" : row.status === "pending_renewal" ? "expiring" : row.status || "valid";
  return {
    id: String(row.id),
    name: row.name || "Document",
    category: row.category || "License",
    status,
    expiry: row.expiryDate ? new Date(row.expiryDate).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—",
    size: formatBytes(row.fileSize),
    uploadedOn: row.createdAt ? new Date(row.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—",
    fileType: row.fileType || "PDF",
    fileUrl: row.fileUrl || "",
  };
}

function mapHw(row: any): HwRow {
  const status = row.status === "online" ? "online" : row.status === "offline" ? "offline" : row.status || "offline";
  return {
    id: String(row.id),
    name: row.name || "Device",
    type: row.type || "desktop",
    location: row.location || "—",
    status,
    battery: row.battery ?? null,
    lastSeen: row.last_ping ? new Date(row.last_ping).toLocaleString() : "—",
    assignedTo: row.assignedTo || row.location || "—",
    serialNo: row.serial || row.serialNo || "—",
    model: row.model || "",
    // The device store keeps whatever it is given, so what a terminal cost can sit beside
    // it rather than in a spreadsheet nobody opens.
    cost: Number(row.cost) || 0,
    purchasedOn: row.purchasedOn || "",
  };
}

export default function DocumentHardware() {
  const { restaurantId } = useRestaurant();
  const { confirm, confirmDialog } = useConfirm();
  const [hwForm, setHwForm] = useState<any | null>(null);
  const [savingHw, setSavingHw] = useState(false);
  const [tab, setTab] = useState<Tab>("documents");
  const [catFilter, setCatFilter] = useState("all");
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [hardware, setHardware] = useState<HwRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocRow | null>(null);
  const [newDoc, setNewDoc] = useState<{ name: string; category: string; expiryDate: string; fileUrl: string; fileType: string; fileSize: number; fileName: string }>(
    { name: "", category: "License", expiryDate: "", fileUrl: "", fileType: "", fileSize: 0, fileName: "" },
  );

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setNewDoc(p => ({
        ...p,
        fileUrl: String(reader.result || ""),
        fileType: (file.type.split("/")[1] || file.name.split(".").pop() || "file").toUpperCase(),
        fileSize: file.size,
        fileName: file.name,
        name: p.name || file.name.replace(/\.[^.]+$/, ""),
      }));
    };
    reader.readAsDataURL(file);
  }

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setApiError(null);
    try {
      const [docs, hw] = await Promise.all([
        documentsApi.list(restaurantId),
        hardwareApi.get(restaurantId),
      ]);
      setDocuments(Array.isArray(docs) ? docs.map(mapDoc) : []);
      const deviceList = hw?.devices ?? [];
      setHardware(Array.isArray(deviceList) ? deviceList.map(mapHw) : []);
    } catch {
      setApiError("Could not load documents or hardware.");
      setDocuments([]);
      setHardware([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  const expiring = documents.filter(d => d.status === "expiring" || d.status === "expired").length;
  const offlineHW = hardware.filter(h => h.status === "offline" || h.status === "low-battery").length;
  const categories = ["all", ...Array.from(new Set(documents.map(d => d.category)))];
  const filteredDocs = documents.filter(d => catFilter === "all" || d.category === catFilter);

  async function saveDoc() {
    if (!restaurantId || !newDoc.name.trim() || !newDoc.fileUrl || uploading) return;
    setUploading(true);
    try {
      await documentsApi.create(restaurantId, {
        name: newDoc.name.trim(),
        category: newDoc.category,
        fileUrl: newDoc.fileUrl,
        fileType: newDoc.fileType || "PDF",
        fileSize: newDoc.fileSize,
        expiryDate: newDoc.expiryDate || undefined,
      });
      setNewDoc({ name: "", category: "License", expiryDate: "", fileUrl: "", fileType: "", fileSize: 0, fileName: "" });
      setShowUpload(false);
      await load();
    } catch { setApiError("Upload failed. Try again."); }
    finally { setUploading(false); }
  }

  /**
   * Devices were listed and nothing more: adding a terminal, correcting a serial or
   * retiring one all existed on the server with no control anywhere in the panel.
   */
  async function saveHardware() {
    if (!restaurantId || !hwForm) return;
    if (!String(hwForm.name || "").trim()) {
      toast({ title: "Give the device a name", variant: "destructive" });
      return;
    }
    setSavingHw(true);
    const body = {
      name: String(hwForm.name).trim(),
      type: hwForm.type,
      model: hwForm.model,
      serial: hwForm.serialNo === "—" ? "" : hwForm.serialNo,
      location: hwForm.location === "—" ? "" : hwForm.location,
      assignedTo: hwForm.assignedTo === "—" ? "" : hwForm.assignedTo,
      status: hwForm.status,
      cost: Number(hwForm.cost) || 0,
      purchasedOn: hwForm.purchasedOn || "",
    };
    try {
      if (hwForm.id) await hardwareApi.update(restaurantId, Number(hwForm.id), body);
      else await hardwareApi.create(restaurantId, body);
      await load();
      toast({ title: hwForm.id ? "Device updated" : "Device added" });
      setHwForm(null);
    } catch (e: any) {
      toast({ title: "Could not save the device", description: e?.message, variant: "destructive" });
    } finally {
      setSavingHw(false);
    }
  }

  async function deleteHardware(hw: HwRow) {
    if (!restaurantId) return;
    const ok = await confirm({
      title: `Remove ${hw.name}?`,
      description: "It disappears from the device list and stops being counted as online.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      await hardwareApi.delete(restaurantId, Number(hw.id));
      await load();
      toast({ title: `${hw.name} removed` });
    } catch (e: any) {
      toast({ title: "Could not remove the device", description: e?.message, variant: "destructive" });
    }
  }

  async function pingHardware(hw: HwRow) {
    if (!restaurantId) return;
    try {
      await hardwareApi.ping(restaurantId, Number(hw.id));
      await load();
      toast({ title: `${hw.name} marked in service` });
    } catch (e: any) {
      toast({ title: "Could not update the device", description: e?.message, variant: "destructive" });
    }
  }

  async function deleteDoc(d: DocRow) {
    if (!restaurantId) return;
    const ok = await confirm({
      title: `Delete ${d.name}?`,
      description: "The stored file goes with it.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await documentsApi.delete(restaurantId, Number(d.id));
      await load();
      toast({ title: "Document deleted" });
    } catch (e: any) {
      toast({ title: "Could not delete the document", description: e?.message, variant: "destructive" });
    }
  }

  function viewFile(d: DocRow) {
    // data: URLs / http links open in a new tab; if no file was stored, show the preview modal.
    if (d.fileUrl && (d.fileUrl.startsWith("data:") || d.fileUrl.startsWith("http"))) {
      window.open(d.fileUrl, "_blank", "noopener,noreferrer");
    } else {
      setViewDoc(d);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold">Documents & Hardware</h1>
          <p className="text-sm text-muted-foreground mt-1">Licence and GST documents, and the device register</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="flex items-center gap-2 bg-muted hover-elevate text-foreground font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
            <Loader className="h-4 w-4" /> Refresh
          </button>
          {tab === "documents" && (
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              <Upload className="h-4 w-4" /> Upload Document
            </button>
          )}
        </div>
      </div>

      {apiError && <div className="p-3 rounded-lg bg-danger-subtle border border-danger-border text-danger text-sm">{apiError}</div>}
      {loading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader className="h-4 w-4 animate-spin"/>Loading...</div>}

      {(expiring > 0 || offlineHW > 0) && (
        <div className="space-y-2">
          {expiring > 0 && <div className="flex items-center gap-2 p-3 bg-warning-subtle border border-warning-border rounded-lg"><AlertTriangle className="h-4 w-4 text-warning shrink-0" /><p className="text-xs text-warning">{expiring} document(s) expiring or expired</p></div>}
          {offlineHW > 0 && <div className="flex items-center gap-2 p-3 bg-danger-subtle border border-danger-border rounded-lg"><Monitor className="h-4 w-4 text-danger shrink-0" /><p className="text-xs text-danger">{offlineHW} device(s) marked as needing attention</p></div>}
        </div>
      )}

      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {[
          { id: "documents", label: "Document Vault", icon: FileText },
          { id: "hardware", label: "Hardware", icon: Monitor },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "documents" && (
        <>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${catFilter === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover-elevate"}`}>{c}</button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredDocs.map(doc => {
              const sc = DOC_STATUS_CFG[doc.status] || DOC_STATUS_CFG.valid;
              const StatusIcon = sc.icon;
              return (
                <div key={doc.id} className={`bg-card border rounded-lg p-4 flex items-center gap-3 ${doc.status === "expired" ? "border-danger-border" : doc.status === "expiring" ? "border-warning-border" : "border-border"}`}>
                  <div className="h-10 w-10 rounded-lg bg-info-subtle flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-info" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{doc.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color} flex items-center gap-1`}>
                        <StatusIcon className="h-3 w-3" />{sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className={CAT_COLOR[doc.category] || "text-muted-foreground"}>{doc.category}</span>
                      <span>Expires: {doc.expiry}</span>
                      <span>{doc.size}</span>
                      <span>{doc.fileType}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => viewFile(doc)} title="View document" className="h-9 w-9 rounded-lg border border-border bg-muted text-muted-foreground hover-elevate flex items-center justify-center">
                      <Eye className="h-4 w-4" />
                    </button>
                    {doc.fileUrl && (doc.fileUrl.startsWith("data:") || doc.fileUrl.startsWith("http")) && (
                      <a href={doc.fileUrl} download={`${doc.name}.${(doc.fileType || "pdf").toLowerCase()}`} title="Download" className="h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {/* A licence uploaded by mistake, or one that has been superseded, had
                        no way out of the vault. */}
                    {(
                      <button onClick={() => deleteDoc(doc)} title="Delete document" aria-label={`Delete ${doc.name}`} className="h-9 w-9 rounded-lg border border-danger-border bg-danger-subtle text-danger hover-elevate flex items-center justify-center">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredDocs.length === 0 && !loading && <p className="text-center text-muted-foreground py-12">No documents uploaded yet</p>}
          </div>
        </>
      )}

      {tab === "hardware" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {hardware.length} devices · ₹{hardware.reduce((s, h) => s + h.cost, 0).toLocaleString()} of equipment
            </p>
            <button onClick={() => setHwForm({ ...BLANK_HW })} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              <Plus className="h-4 w-4" /> Add Device
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Devices", value: hardware.length, color: "text-info", bg: "bg-info-subtle" },
              { label: "Online", value: hardware.filter(h => h.status === "online").length, color: "text-success", bg: "bg-success-subtle" },
              { label: "Offline", value: hardware.filter(h => h.status === "offline").length, color: "text-danger", bg: "bg-danger-subtle" },
              { label: "Issues", value: offlineHW, color: "text-warning", bg: "bg-warning-subtle" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-border rounded-lg p-3 text-center`}>
                <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {hardware.map(hw => {
            const tc = HW_TYPE_CFG[hw.type] || HW_TYPE_CFG.desktop;
            const sc = HW_STATUS_CFG[hw.status] || HW_STATUS_CFG.offline;
            const HWIcon = tc.icon;
            return (
              <div key={hw.id} className={`bg-card border rounded-lg p-4 ${hw.status === "offline" ? "border-danger-border" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${tc.bg} flex items-center justify-center shrink-0`}>
                    <HWIcon className={`h-5 w-5 ${tc.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{hw.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{hw.location}</span>
                      <span>{hw.assignedTo}</span>
                      <span className="font-mono text-muted-foreground">{hw.serialNo}</span>
                      {hw.model && <span className="text-muted-foreground">{hw.model}</span>}
                      {hw.cost > 0 && <span className="text-primary font-semibold">₹{hw.cost.toLocaleString()}</span>}
                    </div>
                  </div>
                  {hw.battery !== null && (
                    <div className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${hw.battery <= 20 ? "text-danger" : "text-success"}`}>
                      <Battery className="h-3.5 w-3.5" />{hw.battery}%
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => pingHardware(hw)} aria-label={`Mark ${hw.name} in service`} title="Mark this device in service" className="h-8 w-8 rounded-lg bg-success-subtle text-success flex items-center justify-center hover-elevate">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setHwForm({ ...hw })} aria-label={`Edit ${hw.name}`} className="h-8 w-8 rounded-lg bg-info-subtle text-info flex items-center justify-center hover-elevate">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteHardware(hw)} aria-label={`Remove ${hw.name}`} className="h-8 w-8 rounded-lg bg-danger-subtle text-danger flex items-center justify-center hover-elevate">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {hardware.length === 0 && !loading && <p className="text-center text-muted-foreground py-12">No devices yet — use Add Device to register one.</p>}
        </div>
      )}

      {/* Upload document modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-md bg-card rounded-lg border border-border text-foreground max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Upload document</h3>
              <button onClick={() => setShowUpload(false)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Document name <span className="text-danger">*</span></label>
                <input value={newDoc.name} onChange={e => setNewDoc(p => ({ ...p, name: e.target.value }))} placeholder="e.g. FSSAI License" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Category</label>
                  <select value={newDoc.category} onChange={e => setNewDoc(p => ({ ...p, category: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                    {["License", "GST", "Safety", "Agreement", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Expiry date</label>
                  <input type="date" value={newDoc.expiryDate} onChange={e => setNewDoc(p => ({ ...p, expiryDate: e.target.value }))} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">File (PDF / image) <span className="text-danger">*</span></label>
                <input type="file" accept=".pdf,image/*" onChange={onFilePick} className="w-full text-sm text-primary-foreground/70 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-bold file:cursor-pointer" />
                {newDoc.fileName && <p className="text-2xs text-success mt-1">{newDoc.fileName} · {formatBytes(newDoc.fileSize)}</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowUpload(false)} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted text-sm font-semibold">Cancel</button>
                <button onClick={saveDoc} disabled={uploading || !newDoc.name.trim() || !newDoc.fileUrl} className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                  {uploading ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View document (fallback when no file stored) */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewDoc(null)}>
          <div className="w-full max-w-sm bg-card rounded-lg border border-border text-foreground max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-info" /> {viewDoc.name}</h3>
              <button onClick={() => setViewDoc(null)}><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              {[["Category", viewDoc.category], ["Status", viewDoc.status], ["Expires", viewDoc.expiry], ["Size", viewDoc.size], ["Type", viewDoc.fileType], ["Uploaded", viewDoc.uploadedOn]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">No file is attached to this document — use "Upload Document" to attach one, then preview and download will be available here.</p>
            </div>
          </div>
        </div>
      )}

      {hwForm && (
        <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card rounded-lg border border-border text-foreground max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="font-semibold">{hwForm.id ? "Edit Device" : "Add Device"}</h3>
              <button onClick={() => setHwForm(null)} aria-label="Close"><X className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Device Name", field: "name", type: "text", placeholder: "e.g. Counter POS" },
                { label: "Type", field: "type", type: "select", options: Object.keys(HW_TYPE_CFG) },
                { label: "Model", field: "model", type: "text", placeholder: "e.g. Sunmi T2" },
                { label: "Serial Number", field: "serialNo", type: "text", placeholder: "SN-…" },
                { label: "Location", field: "location", type: "text", placeholder: "e.g. Kitchen" },
                { label: "Assigned To", field: "assignedTo", type: "text", placeholder: "Staff or station" },
                { label: "Status", field: "status", type: "select", options: Object.keys(HW_STATUS_CFG) },
                { label: "Purchase Price (₹)", field: "cost", type: "number", placeholder: "e.g. 24000" },
                { label: "Purchased On", field: "purchasedOn", type: "date" },
              ].map(({ label, field, type, placeholder, options }) => (
                <div key={field}>
                  <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                  {type === "select" ? (
                    <select value={hwForm[field] || ""} onChange={e => setHwForm({ ...hwForm, [field]: e.target.value })} className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/40">
                      {options?.map(o => <option key={o} value={o}>{HW_TYPE_CFG[o]?.label ?? HW_STATUS_CFG[o]?.label ?? o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={hwForm[field] === "—" ? "" : (hwForm[field] ?? "")}
                      onChange={e => setHwForm({ ...hwForm, [field]: type === "number" ? Number(e.target.value) : e.target.value })}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground"
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setHwForm(null)} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted text-sm font-semibold">Cancel</button>
                <button onClick={saveHardware} disabled={savingHw} className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40">
                  {savingHw ? "Saving…" : hwForm.id ? "Save Changes" : "Add Device"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
