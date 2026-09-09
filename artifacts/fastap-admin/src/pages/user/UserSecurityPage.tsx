import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { getDeviceId } from "@/lib/smartEntry";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useGuestBack } from "@/hooks/useGuestBack";
import { useUser } from "@/contexts/UserContext";
import { Shield, Smartphone, Bell, AlertTriangle, Trash2, CheckCircle } from "lucide-react";

type Device = { id: string; name: string; lastSeen: string; trusted: boolean; loginCount: number };
type LoginAlert = { id: string; at: string; deviceName: string; suspicious: boolean; message: string; read: boolean };
type Security = { sessionTimeoutMinutes: number; fraudProtection: boolean; loginAlertsEnabled: boolean };

export default function UserSecurityPage() {
  const goBack = useGuestBack();
  const { user } = useUser();
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<LoginAlert[]>([]);
  const [security, setSecurity] = useState<Security>({ sessionTimeoutMinutes: 30, fraudProtection: true, loginAlertsEnabled: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const currentId = getDeviceId();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      publicApi.auth.devices(),
      publicApi.auth.loginAlerts(),
      publicApi.auth.security(),
    ]).then(([d, a, s]) => {
      setDevices((d.devices ?? []) as Device[]);
      setAlerts((a.alerts ?? []) as LoginAlert[]);
      setSecurity(s.security ? { ...security, ...(s.security as Partial<Security>) } : security);
      setLoadError("");
      // An empty device list would otherwise read as "no one else is signed in".
    }).catch(e => setLoadError(e instanceof Error ? e.message : "Could not reach the server."))
      .finally(() => setLoading(false));
  }, [user]);

  // None of these four had any error handling: a failed request threw into nowhere and
  // the screen simply did not change. Someone trying to sign a lost phone out was left
  // believing they had, with no message of any kind.
  async function removeDevice(id: string) {
    setActionError("");
    try {
      const r = await publicApi.auth.removeDevice(id);
      setDevices((r.devices ?? []) as Device[]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That device is still signed in — please try again.");
    }
  }

  async function trustDevice(id: string) {
    setActionError("");
    try {
      const r = await publicApi.auth.trustDevice(id);
      setDevices((r.devices ?? []) as Device[]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not mark that device as trusted.");
    }
  }

  async function markRead() {
    setActionError("");
    try {
      await publicApi.auth.markAlertsRead();
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not mark these as read.");
    }
  }

  async function updateSecurity(patch: Partial<Security>) {
    setActionError("");
    const next = { ...security, ...patch };
    try {
      const r = await publicApi.auth.updateSecurity(next);
      setSecurity(r.security ? { ...next, ...(r.security as Partial<Security>) } : next);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That setting was not saved. Please try again.");
    }
  }

  if (!user) {
    return (
      <div className="guest-page min-h-screen text-foreground p-4">
        <GuestBackButton onClick={goBack} />
        <p className="text-center text-muted-foreground mt-20">Sign in to manage security settings</p>
      </div>
    );
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-24">
      <div className="guest-header px-4 py-4 flex items-center gap-3">
        <GuestBackButton onClick={goBack} />
        <div>
          <h1 className="font-display text-lg font-semibold">Privacy & Security</h1>
          <p className="text-xs text-muted-foreground">Device management & login alerts</p>
        </div>
      </div>

      <div className="px-4 space-y-6">
        {actionError && (
          <p role="alert" className="text-xs text-danger bg-danger-subtle border border-danger-border rounded-xl px-3 py-2">
            {actionError}
          </p>
        )}
        <section className="guest-card p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Shield className="h-4 w-4 text-primary" /> Security Features</h2>
          <div className="space-y-3 text-xs">
            {[
              { key: "fraudProtection" as const, label: "Fraud protection", desc: "Flag logins from new devices" },
              { key: "loginAlertsEnabled" as const, label: "Login alerts", desc: "Notify on new sign-ins" },
            ].map(f => (
              <label key={f.key} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className="text-muted-foreground">{f.desc}</p>
                </div>
                <button
                  onClick={() => updateSecurity({ [f.key]: !security[f.key] })}
                  className={`w-11 h-6 rounded-full transition-colors ${security[f.key] ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`h-5 w-5 rounded-full bg-card shadow transition-transform mx-0.5 ${security[f.key] ? "translate-x-5" : ""}`} />
                </button>
              </label>
            ))}
            <label className="block">
              <span className="font-medium">Session timeout (minutes)</span>
              <select
                className="mt-1 w-full bg-muted border border-border rounded-lg px-3 py-2"
                value={security.sessionTimeoutMinutes}
                onChange={e => updateSecurity({ sessionTimeoutMinutes: parseInt(e.target.value, 10) })}
              >
                {[15, 30, 60, 120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="guest-card p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Bell className="h-4 w-4 text-warning" /> Login Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No login alerts yet</p>
          ) : (
            <>
              <button onClick={markRead} className="text-xs text-primary mb-2">Mark all read</button>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alerts.map(a => (
                  <div key={a.id} className={`p-2 rounded-lg text-xs border ${a.read ? "border-border bg-muted" : "border-warning-border bg-warning-subtle"}`}>
                    <div className="flex items-start gap-2">
                      {a.suspicious ? <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" /> : <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />}
                      <div>
                        <p>{a.message}</p>
                        <p className="text-muted-foreground mt-0.5">{new Date(a.at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="guest-card p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Smartphone className="h-4 w-4 text-info" /> Registered Devices</h2>
          {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : loadError ? (
            <p role="alert" className="text-xs text-danger">We could not load your devices. {loadError}</p>
          ) : devices.length === 0 ? (
            <p className="text-xs text-muted-foreground">No devices registered yet</p>
          ) : (
            <div className="space-y-2">
              {devices.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
                  <div>
                    <p className="text-sm font-medium">{d.name} {d.id === currentId && <span className="text-primary text-xs">(this device)</span>}</p>
                    <p className="text-xs text-muted-foreground">Last seen {new Date(d.lastSeen).toLocaleString()} · {d.loginCount} logins</p>
                    {d.trusted && <span className="text-xs text-success">Trusted · one-tap enabled</span>}
                  </div>
                  <div className="flex gap-1">
                    {!d.trusted && (
                      <button onClick={() => trustDevice(d.id)} className="p-2 rounded-lg bg-success-subtle text-success" title="Trust device">
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {d.id !== currentId && (
                      <button onClick={() => removeDevice(d.id)} className="p-2 rounded-lg bg-danger-subtle text-danger" title="Remove">
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
