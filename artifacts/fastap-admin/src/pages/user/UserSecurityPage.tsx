import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { getDeviceId } from "@/lib/smartEntry";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useGuestBack } from "@/hooks/useGuestBack";
import { useUser } from "@/contexts/UserContext";
import { Shield, Smartphone, Bell, AlertTriangle, Trash2, CheckCircle } from "lucide-react";

type Device = { id: string; name: string; lastSeen: string; trusted: boolean; loginCount: number };
type LoginAlert = { id: string; at: string; deviceName: string; suspicious: boolean; message: string; read: boolean };

export default function UserSecurityPage() {
  const goBack = useGuestBack();
  const { user } = useUser();
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<LoginAlert[]>([]);
  const [security, setSecurity] = useState({ sessionTimeoutMinutes: 30, fraudProtection: true, loginAlertsEnabled: true });
  const [loading, setLoading] = useState(true);
  const currentId = getDeviceId();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      publicApi.auth.devices(),
      publicApi.auth.loginAlerts(),
      publicApi.auth.security(),
    ]).then(([d, a, s]) => {
      setDevices(d.devices ?? []);
      setAlerts(a.alerts ?? []);
      setSecurity(s.security ?? security);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  async function removeDevice(id: string) {
    const r = await publicApi.auth.removeDevice(id);
    setDevices(r.devices ?? []);
  }

  async function trustDevice(id: string) {
    const r = await publicApi.auth.trustDevice(id);
    setDevices(r.devices ?? []);
  }

  async function markRead() {
    await publicApi.auth.markAlertsRead();
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  }

  async function updateSecurity(patch: Partial<typeof security>) {
    const next = { ...security, ...patch };
    const r = await publicApi.auth.updateSecurity(next);
    setSecurity(r.security);
  }

  if (!user) {
    return (
      <div className="guest-page min-h-screen text-white p-4">
        <GuestBackButton onClick={goBack} />
        <p className="text-center text-white/50 mt-20">Sign in to manage security settings</p>
      </div>
    );
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header px-4 py-4 flex items-center gap-3">
        <GuestBackButton onClick={goBack} />
        <div>
          <h1 className="font-display text-lg font-bold">Privacy & Security</h1>
          <p className="text-xs text-white/40">Device management & login alerts</p>
        </div>
      </div>

      <div className="px-4 space-y-6">
        <section className="guest-card p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Shield className="h-4 w-4 text-orange-400" /> Security Features</h2>
          <div className="space-y-3 text-xs">
            {[
              { key: "fraudProtection" as const, label: "Fraud protection", desc: "Flag logins from new devices" },
              { key: "loginAlertsEnabled" as const, label: "Login alerts", desc: "Notify on new sign-ins" },
            ].map(f => (
              <label key={f.key} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className="text-white/40">{f.desc}</p>
                </div>
                <button
                  onClick={() => updateSecurity({ [f.key]: !security[f.key] })}
                  className={`w-11 h-6 rounded-full transition-colors ${security[f.key] ? "bg-orange-500" : "bg-white/20"}`}
                >
                  <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform mx-0.5 ${security[f.key] ? "translate-x-5" : ""}`} />
                </button>
              </label>
            ))}
            <label className="block">
              <span className="font-medium">Session timeout (minutes)</span>
              <select
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2"
                value={security.sessionTimeoutMinutes}
                onChange={e => updateSecurity({ sessionTimeoutMinutes: parseInt(e.target.value, 10) })}
              >
                {[15, 30, 60, 120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="guest-card p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Bell className="h-4 w-4 text-amber-400" /> Login Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-xs text-white/40">No login alerts yet</p>
          ) : (
            <>
              <button onClick={markRead} className="text-xs text-orange-400 mb-2">Mark all read</button>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alerts.map(a => (
                  <div key={a.id} className={`p-2 rounded-lg text-xs border ${a.read ? "border-white/5 bg-white/5" : "border-amber-500/30 bg-amber-500/10"}`}>
                    <div className="flex items-start gap-2">
                      {a.suspicious ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" /> : <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                      <div>
                        <p>{a.message}</p>
                        <p className="text-white/30 mt-0.5">{new Date(a.at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="guest-card p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Smartphone className="h-4 w-4 text-blue-400" /> Registered Devices</h2>
          {loading ? <p className="text-xs text-white/40">Loading…</p> : devices.length === 0 ? (
            <p className="text-xs text-white/40">No devices registered yet</p>
          ) : (
            <div className="space-y-2">
              {devices.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm font-medium">{d.name} {d.id === currentId && <span className="text-orange-400 text-xs">(this device)</span>}</p>
                    <p className="text-xs text-white/40">Last seen {new Date(d.lastSeen).toLocaleString()} · {d.loginCount} logins</p>
                    {d.trusted && <span className="text-xs text-emerald-400">Trusted · one-tap enabled</span>}
                  </div>
                  <div className="flex gap-1">
                    {!d.trusted && (
                      <button onClick={() => trustDevice(d.id)} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300" title="Trust device">
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {d.id !== currentId && (
                      <button onClick={() => removeDevice(d.id)} className="p-2 rounded-lg bg-red-500/20 text-red-300" title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
