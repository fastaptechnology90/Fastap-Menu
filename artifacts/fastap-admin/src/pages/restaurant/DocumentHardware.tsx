import { useState, useEffect, useCallback } from "react";
import { FileText, Monitor, Printer, Tablet, Cpu, Upload, Download, CheckCircle, AlertTriangle, Clock, Battery, Loader, Eye, X, Plus } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { documentsApi, hardwareApi } from "@/lib/api";

type Tab = "documents" | "hardware";

type DocRow = {
  id: string; name: string; category: string; status: string; expiry: string; size: string; uploadedOn: string; fileType: string; fileUrl: string;
};

type HwRow = {
  id: string; name: string; type: string; location: string; status: string; battery: number | null; lastSeen: string; assignedTo: string; serialNo: string;
};

const DOC_STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  active: { label: "Valid", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle },
  valid: { label: "Valid", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle },
  pending_renewal: { label: "Expiring", color: "text-yellow-400", bg: "bg-yellow-500/15", icon: Clock },
  expiring: { label: "Expiring", color: "text-yellow-400", bg: "bg-yellow-500/15", icon: Clock },
  expired: { label: "Expired", color: "text-red-400", bg: "bg-red-500/15", icon: AlertTriangle },
};

const HW_TYPE_CFG: Record<string, { label: string; icon: typeof Tablet; color: string; bg: string }> = {
  pos: { label: "POS Terminal", icon: Tablet, color: "text-blue-400", bg: "bg-blue-500/15" },
  kds: { label: "KDS Display", icon: Monitor, color: "text-violet-400", bg: "bg-violet-500/15" },
  display: { label: "Display", icon: Monitor, color: "text-violet-400", bg: "bg-violet-500/15" },
  printer: { label: "Printer", icon: Printer, color: "text-amber-400", bg: "bg-amber-500/15" },
  desktop: { label: "Desktop", icon: Cpu, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  nfc: { label: "NFC Reader", icon: Monitor, color: "text-pink-400", bg: "bg-pink-500/15" },
  tablet: { label: "Tablet", icon: Tablet, color: "text-blue-400", bg: "bg-blue-500/15" },
  kiosk: { label: "Kiosk", icon: Monitor, color: "text-orange-400", bg: "bg-orange-500/15" },
  scanner: { label: "Scanner", icon: Cpu, color: "text-orange-400", bg: "bg-orange-500/15" },
};

const HW_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  online: { label: "Online", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  offline: { label: "Offline", color: "text-red-400", bg: "bg-red-500/15" },
  "low-battery": { label: "Low Battery", color: "text-yellow-400", bg: "bg-yellow-500/15" },
};

const CAT_COLOR: Record<string, string> = {
  License: "text-blue-400", GST: "text-emerald-400", Safety: "text-orange-400", Agreement: "text-violet-400", license: "text-blue-400",
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
  };
}

export default function DocumentHardware() {
  const { restaurantId } = useRestaurant();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Documents & Hardware</h1>
          <p className="text-xs text-white/40">License vault, GST docs & hardware health</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white/70 font-bold px-4 py-2 rounded-xl text-sm transition-all">
            <Loader className="h-4 w-4" /> Refresh
          </button>
          {tab === "documents" && (
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all">
              <Upload className="h-4 w-4" /> Upload Document
            </button>
          )}
        </div>
      </div>

      {apiError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{apiError}</div>}
      {loading && <div className="flex items-center gap-2 text-white/40 text-sm"><Loader className="h-4 w-4 animate-spin"/>Loading...</div>}

      {(expiring > 0 || offlineHW > 0) && (
        <div className="space-y-2">
          {expiring > 0 && <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl"><AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" /><p className="text-xs text-yellow-300">{expiring} document(s) expiring or expired</p></div>}
          {offlineHW > 0 && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"><Monitor className="h-4 w-4 text-red-400 shrink-0" /><p className="text-xs text-red-300">{offlineHW} hardware device(s) need attention</p></div>}
        </div>
      )}

      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {[
          { id: "documents", label: "Document Vault", icon: FileText },
          { id: "hardware", label: "Hardware", icon: Monitor },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${tab === t.id ? "bg-amber-500 text-black" : "text-white/50 hover:text-white"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "documents" && (
        <>
          <div className="flex gap-1 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${catFilter === c ? "bg-amber-500 text-black" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>{c}</button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredDocs.map(doc => {
              const sc = DOC_STATUS_CFG[doc.status] || DOC_STATUS_CFG.valid;
              const StatusIcon = sc.icon;
              return (
                <div key={doc.id} className={`bg-[#0e1520] border rounded-2xl p-4 flex items-center gap-3 ${doc.status === "expired" ? "border-red-500/20" : doc.status === "expiring" ? "border-yellow-500/20" : "border-white/5"}`}>
                  <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{doc.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color} flex items-center gap-1`}>
                        <StatusIcon className="h-3 w-3" />{sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                      <span className={CAT_COLOR[doc.category] || "text-white/40"}>{doc.category}</span>
                      <span>Expires: {doc.expiry}</span>
                      <span>{doc.size}</span>
                      <span>{doc.fileType}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => viewFile(doc)} title="View document" className="h-9 w-9 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 flex items-center justify-center">
                      <Eye className="h-4 w-4" />
                    </button>
                    {doc.fileUrl && (doc.fileUrl.startsWith("data:") || doc.fileUrl.startsWith("http")) && (
                      <a href={doc.fileUrl} download={`${doc.name}.${(doc.fileType || "pdf").toLowerCase()}`} title="Download" className="h-9 w-9 rounded-xl border border-white/10 text-white/50 hover:text-white hover:bg-white/5 flex items-center justify-center">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredDocs.length === 0 && !loading && <p className="text-center text-white/30 py-12">No documents uploaded yet</p>}
          </div>
        </>
      )}

      {tab === "hardware" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Devices", value: hardware.length, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Online", value: hardware.filter(h => h.status === "online").length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
              { label: "Offline", value: hardware.filter(h => h.status === "offline").length, color: "text-red-400", bg: "bg-red-500/10" },
              { label: "Issues", value: offlineHW, color: "text-orange-400", bg: "bg-orange-500/10" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border border-white/5 rounded-2xl p-3 text-center`}>
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {hardware.map(hw => {
            const tc = HW_TYPE_CFG[hw.type] || HW_TYPE_CFG.desktop;
            const sc = HW_STATUS_CFG[hw.status] || HW_STATUS_CFG.offline;
            const HWIcon = tc.icon;
            return (
              <div key={hw.id} className={`bg-[#0e1520] border rounded-2xl p-4 ${hw.status === "offline" ? "border-red-500/20" : "border-white/5"}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${tc.bg} flex items-center justify-center shrink-0`}>
                    <HWIcon className={`h-5 w-5 ${tc.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{hw.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                      <span>{hw.location}</span>
                      <span>{hw.assignedTo}</span>
                      <span className="font-mono text-white/20">{hw.serialNo}</span>
                    </div>
                  </div>
                  {hw.battery !== null && (
                    <div className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${hw.battery <= 20 ? "text-red-400" : "text-emerald-400"}`}>
                      <Battery className="h-3.5 w-3.5" />{hw.battery}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {hardware.length === 0 && !loading && <p className="text-center text-white/30 py-12">No hardware devices — defaults appear after first API load</p>}
        </div>
      )}

      {/* Upload document modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-md bg-[#111827] rounded-2xl border border-white/10 text-white max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-bold flex items-center gap-2"><Upload className="h-5 w-5 text-amber-400" /> Upload document</h3>
              <button onClick={() => setShowUpload(false)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Document name <span className="text-red-400">*</span></label>
                <input value={newDoc.name} onChange={e => setNewDoc(p => ({ ...p, name: e.target.value }))} placeholder="e.g. FSSAI License" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Category</label>
                  <select value={newDoc.category} onChange={e => setNewDoc(p => ({ ...p, category: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white">
                    {["License", "GST", "Safety", "Agreement", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Expiry date</label>
                  <input type="date" value={newDoc.expiryDate} onChange={e => setNewDoc(p => ({ ...p, expiryDate: e.target.value }))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">File (PDF / image) <span className="text-red-400">*</span></label>
                <input type="file" accept=".pdf,image/*" onChange={onFilePick} className="w-full text-sm text-white/70 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-amber-500 file:text-black file:font-bold file:cursor-pointer" />
                {newDoc.fileName && <p className="text-[11px] text-emerald-400 mt-1">{newDoc.fileName} · {formatBytes(newDoc.fileSize)}</p>}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowUpload(false)} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Cancel</button>
                <button onClick={saveDoc} disabled={uploading || !newDoc.name.trim() || !newDoc.fileUrl} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  {uploading ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View document (fallback when no file stored) */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewDoc(null)}>
          <div className="w-full max-w-sm bg-[#111827] rounded-2xl border border-white/10 text-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 className="font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-blue-400" /> {viewDoc.name}</h3>
              <button onClick={() => setViewDoc(null)}><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
            </div>
            <div className="p-5 space-y-2 text-sm">
              {[["Category", viewDoc.category], ["Status", viewDoc.status], ["Expires", viewDoc.expiry], ["Size", viewDoc.size], ["Type", viewDoc.fileType], ["Uploaded", viewDoc.uploadedOn]].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 pb-2"><span className="text-white/40">{k}</span><span className="font-medium">{v}</span></div>
              ))}
              <p className="text-xs text-white/40 pt-2">No file is attached to this document — use "Upload Document" to attach one, then preview and download will be available here.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
