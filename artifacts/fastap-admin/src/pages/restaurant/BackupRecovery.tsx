import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { backupApi } from "@/lib/api";
import type { BackupRow } from "@/lib/restaurant-types";
import { Database, Download, RotateCcw, Plus, Trash2, Clock, Check, AlertTriangle, Settings, Shield, RefreshCw, HardDrive, Calendar, Zap, Lock } from "lucide-react";

const DEFAULT_SCHEDULE = {
  enabled: true,
  frequency: "daily",
  time: "03:00",
  retention: 14,
  compress: true,
  includeMedia: false,
  notifyOnFail: true,
  notifyEmail: "",
};

type Tab = "backups"|"restore"|"settings";

export default function BackupRecovery() {
  const { restaurantId } = useRestaurant();
  const [tab, setTab] = useState<Tab>("backups");
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [savedSettings, setSavedSettings] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<BackupRow | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const successBackups = backups.filter(b=>b.status==="completed");
  const latestBackup = successBackups[0];

  useEffect(() => {
    if (!restaurantId) return;
    backupApi.get(restaurantId).then(d => {
      if (d.backups?.length) {
        setBackups(d.backups.map((b: any) => ({
          id: String(b.id),
          name: b.name,
          type: b.type === "auto" ? "automatic" : "manual",
          size: b.size || "—",
          status: b.status,
          checksum: b.checksum || "—",
          duration: b.duration || "—",
          tables: Array.isArray(b.tables) ? b.tables.length : b.tables || 0,
          records: b.records || 0,
          createdAt: b.created_at ? new Date(b.created_at).toLocaleString() : "—",
        })));
      }
      if (d.settings) {
        setSchedule(s => ({
          ...s,
          enabled: d.settings.auto_backup ?? s.enabled,
          frequency: d.settings.frequency ?? s.frequency,
          time: d.settings.time ?? s.time,
          retention: d.settings.retention_days ?? s.retention,
          compress: d.settings.compress ?? s.compress,
          includeMedia: d.settings.include_media ?? s.includeMedia,
        }));
      }
    }).catch(() => {});
  }, [restaurantId]);

  async function downloadBackup(backup: BackupRow) {
    if (!restaurantId) return;
    await backupApi.download(restaurantId, parseInt(backup.id, 10) || 0).catch(() => {});
  }

  async function createBackup() {
    if (!restaurantId) return;
    setCreating(true);
    try {
      const created = await backupApi.create(restaurantId, { name: `Manual Backup — ${new Date().toLocaleDateString("en-IN")}` });
      if (created) {
        setBackups(b => [{
          id: String(created.id),
          name: created.name,
          type: "manual",
          size: created.size || "—",
          status: created.status || "completed",
          checksum: created.checksum || "—",
          duration: created.duration || "—",
          tables: 0,
          records: 0,
          createdAt: new Date().toLocaleString(),
        }, ...b]);
      }
    } catch {
      /* backup failed — no fake row */
    } finally {
      setCreating(false);
    }
  }

  async function doRestore(backup: BackupRow) {
    if (!restaurantId) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      await backupApi.restore(restaurantId, parseInt(backup.id, 10) || 0);
      setConfirmRestore(null);
    } catch {
      setRestoreError("Restore failed. Please try again or contact support.");
    } finally {
      setRestoring(false);
    }
  }

  const filtered = backups.filter(b=>filterType==="all"||b.type===filterType);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Backup & Recovery</h1>
          <p className="text-xs text-white/40">Database backups, restore points and auto-schedule</p>
        </div>
        <button onClick={createBackup} disabled={creating} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold shadow-lg shadow-amber-500/20 disabled:opacity-60 transition-all">
          <Database className={`h-4 w-4 ${creating?"animate-pulse":""}`}/>{creating?"Creating...":"Create Backup Now"}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:"Total Backups",value:backups.length,icon:Database,color:"text-blue-400",bg:"bg-blue-500/10"},
          {label:"Latest Backup",value:latestBackup?`${latestBackup.size}`:"None",icon:Clock,color:"text-emerald-400",bg:"bg-emerald-500/10"},
          {label:"Storage Used",value:`${backups.filter(b=>b.status==="completed").reduce((s,b)=>s+parseFloat(b.size||"0"),0).toFixed(0)} MB`,icon:HardDrive,color:"text-amber-400",bg:"bg-amber-500/10"},
          {label:"Failed",value:backups.filter(b=>b.status==="failed").length,icon:AlertTriangle,color:"text-red-400",bg:"bg-red-500/10"},
        ].map(s=>(
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-white/5 p-4 flex items-center gap-3`}>
            <div className={`h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}><s.icon className="h-5 w-5"/></div>
            <div><p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p><p className="text-xs text-white/40">{s.label}</p></div>
          </div>
        ))}
      </div>

      {latestBackup&&(
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-emerald-400 shrink-0"/>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-300">Last backup: {latestBackup.createdAt}</p>
            <p className="text-xs text-emerald-400/60">{latestBackup.size} · {latestBackup.records.toLocaleString()} records · Checksum: {latestBackup.checksum}</p>
          </div>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-semibold">Protected</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {([["backups","All Backups"],["restore","Restore"],["settings","Schedule"]] as [Tab,string][]).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab===t?"bg-amber-500 text-black":"text-white/50 hover:text-white"}`}>{l}</button>
        ))}
      </div>

      {tab==="backups"&&(
        <>
          <div className="flex gap-2">
            {["all","automatic","manual"].map(f=>(
              <button key={f} onClick={()=>setFilterType(f)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-all ${filterType===f?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/40"}`}>{f==="all"?"All Types":f}</button>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map(backup=>(
              <div key={backup.id} className={`bg-[#0e1520] border rounded-2xl p-4 ${backup.status==="failed"?"border-red-500/20":"border-white/5"}`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${backup.status==="completed"?"bg-emerald-500/15":"bg-red-500/15"}`}>
                    {backup.status==="completed" ? <Check className="h-5 w-5 text-emerald-400"/> : <AlertTriangle className="h-5 w-5 text-red-400"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold truncate">{backup.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${backup.type==="automatic"?"bg-blue-500/15 text-blue-400":"bg-amber-500/15 text-amber-400"}`}>{backup.type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
                      {backup.status==="completed"&&<>
                        <span>{backup.size}</span>
                        <span>{backup.records.toLocaleString()} records</span>
                        <span>⏱ {backup.duration}</span>
                        <span className="font-mono text-white/20">{backup.checksum}</span>
                      </>}
                      {backup.status==="failed"&&<span className="text-red-400">Backup failed — check disk space</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {backup.status==="completed"&&(
                      <>
                        <button onClick={() => downloadBackup(backup)} className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"><Download className="h-3.5 w-3.5"/></button>
                        <button onClick={()=>setConfirmRestore(backup)} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30">Restore</button>
                      </>
                    )}
                    {backup.type==="manual"&&<button onClick={async()=>{ if(!restaurantId) return; if(!confirm("Delete this backup?")) return; setBackups(b=>b.filter(x=>x.id!==backup.id)); await backupApi.delete(restaurantId, parseInt(backup.id,10)||0).catch(()=>{}); }} className="h-8 w-8 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400/60 hover:text-red-400 transition-all"><Trash2 className="h-3.5 w-3.5"/></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==="restore"&&(
        <div className="space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5"/>
            <div>
              <p className="text-sm font-semibold text-yellow-300">Important: Restore will overwrite current data</p>
              <p className="text-xs text-yellow-400/60 mt-0.5">A restore operation replaces ALL current restaurant data with the backup. This cannot be undone. Always create a fresh backup before restoring.</p>
            </div>
          </div>

          <div className="space-y-2">
            {successBackups.map(backup=>(
              <div key={backup.id} className="bg-[#0e1520] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0"><Database className="h-5 w-5 text-blue-400"/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{backup.name}</p>
                  <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                    <span>{backup.size}</span><span>·</span><span>{backup.records.toLocaleString()} records</span><span>·</span><span>{backup.createdAt}</span>
                  </div>
                </div>
                <button onClick={()=>setConfirmRestore(backup)} className="px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/15 text-blue-400 text-xs font-semibold hover:bg-blue-500/25 flex items-center gap-1">
                  <RotateCcw className="h-3 w-3"/>Restore This
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Automatic Backup Schedule</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-semibold">Enable Auto Backup</p><p className="text-xs text-white/40">Run backups on schedule automatically</p></div>
                <button onClick={()=>setSchedule(s=>({...s,enabled:!s.enabled}))} className={`h-6 w-11 rounded-full transition-all relative ${schedule.enabled?"bg-amber-500":"bg-white/10"}`}>
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${schedule.enabled?"left-[22px]":"left-0.5"}`}/>
                </button>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Frequency</label>
                <div className="flex gap-2">
                  {["hourly","daily","weekly"].map(f=>(
                    <button key={f} onClick={()=>setSchedule(s=>({...s,frequency:f}))} className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition-all ${schedule.frequency===f?"bg-amber-500/20 border-amber-500/40 text-amber-300":"border-white/10 bg-white/5 text-white/50"}`}>{f}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Time</label>
                <input type="time" value={schedule.time} onChange={e=>setSchedule(s=>({...s,time:e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40 text-white"/>
              </div>
              <div><label className="text-xs text-white/40 mb-1.5 block uppercase tracking-wide">Retention Period (days)</label>
                <div className="flex items-center gap-3">
                  <button onClick={()=>setSchedule(s=>({...s,retention:Math.max(3,s.retention-1)}))} className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">−</button>
                  <span className="flex-1 text-center text-lg font-bold text-amber-400">{schedule.retention} days</span>
                  <button onClick={()=>setSchedule(s=>({...s,retention:s.retention+1}))} className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">+</button>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-[#0e1520] border border-white/5 rounded-2xl p-5">
            <h3 className="font-bold mb-4">Backup Options</h3>
            <div className="space-y-3">
              {[
                {key:"compress",label:"Compress backups",desc:"Reduce storage by ~60% with compression"},
                {key:"includeMedia",label:"Include media files",desc:"Include uploaded images and documents"},
                {key:"notifyOnFail",label:"Alert on failure",desc:"Send notification if backup fails"},
              ].map(({key,label,desc})=>(
                <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/8">
                  <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-white/40">{desc}</p></div>
                  <button onClick={()=>setSchedule(s=>({...s,[key]:!(s as any)[key]}))} className={`h-6 w-11 rounded-full transition-all relative shrink-0 ${(schedule as any)[key]?"bg-amber-500":"bg-white/10"}`}>
                    <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${(schedule as any)[key]?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={async ()=>{
              if (!restaurantId) return;
              try {
                await backupApi.updateSettings(restaurantId, {
                  auto_backup: schedule.enabled,
                  frequency: schedule.frequency,
                  time: schedule.time,
                  retention_days: schedule.retention,
                  compress: schedule.compress,
                  include_media: schedule.includeMedia,
                });
                setSavedSettings(true);
                setTimeout(()=>setSavedSettings(false),2000);
              } catch { /* settings save failed */ }
            }} className={`mt-5 w-full py-3 rounded-xl font-bold text-sm transition-all ${savedSettings?"bg-emerald-500 text-white":"bg-amber-500 hover:bg-amber-400 text-black"}`}>
              {savedSettings?"✓ Settings Saved":"Save Schedule Settings"}
            </button>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {confirmRestore&&(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="text-center mb-5">
              <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4"><RotateCcw className="h-8 w-8 text-red-400"/></div>
              <h3 className="text-lg font-extrabold">Restore Database?</h3>
              <p className="text-sm text-white/50 mt-2">This will restore to: <strong className="text-white/80">{confirmRestore.name}</strong></p>
              <p className="text-sm text-red-400 mt-2 font-semibold">All current data will be overwritten. This cannot be undone.</p>
              {restoreError && <p className="text-sm text-red-400 mt-3">{restoreError}</p>}
            </div>
            {restoring ? (
              <div className="text-center py-6">
                <RefreshCw className="h-10 w-10 text-blue-400 animate-spin mx-auto mb-3"/>
                <p className="text-sm text-white/60">Restoring database... Please wait</p>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={()=>setConfirmRestore(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-semibold">Cancel</button>
                <button onClick={()=>doRestore(confirmRestore)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-sm">Yes, Restore</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
