import { useState } from "react";
import { useLocation } from "wouter";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import { restaurantAuth } from "@/lib/api";
import { PanelLogo } from "@/components/shared/PanelLogo";

/**
 * Opened from the reset link in the email: /reset-password?token=...&staff=1
 * Sets a new password using the signed token. `staff=1` routes to the staff endpoint.
 */
export default function ResetPassword() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const isStaff = params.get("staff") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const loginPath = isStaff ? "/restaurant/login" : "/login";

  async function submit() {
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (!token) { setError("This reset link is missing its token. Please request a new one."); return; }
    setLoading(true); setError("");
    try {
      if (isStaff) await restaurantAuth.resetPassword(token, password);
      else await api.auth.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError((e as Error).message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0b1220] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-7">
        <div className="flex justify-center mb-5"><PanelLogo panel="admin" showLabel label="Fastap OS" /></div>
        {done ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400" />
            <h1 className="text-lg font-bold">Password updated</h1>
            <p className="text-sm text-white/60">You can now sign in with your new password.</p>
            <button onClick={() => navigate(loginPath)} className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400">Go to login</button>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-bold flex items-center gap-2 mb-1"><KeyRound className="h-5 w-5" /> Set a new password</h1>
            <p className="text-sm text-white/50 mb-5">Choose a strong password for your account.</p>
            <div className="space-y-3">
              <input
                type="password"
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
              />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void submit(); }}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button onClick={() => void submit()} disabled={loading} className="w-full py-3 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-amber-400">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Update password
              </button>
              <button onClick={() => navigate(loginPath)} className="w-full text-center text-sm text-white/40 hover:text-white pt-1">Back to login</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
