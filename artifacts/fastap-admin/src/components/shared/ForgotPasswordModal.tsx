import { useState } from "react";
import { X, Loader2, Mail, CheckCircle2, KeyRound } from "lucide-react";
import { api } from "@/lib/apiClient";
import { restaurantAuth } from "@/lib/api";

type Scope = "admin" | "staff";
type Step = "email" | "reset" | "sent" | "done";

/**
 * Self-service password reset, shared by the admin and staff login pages.
 * Step 1 asks for the email. In demo mode (no email provider) the API returns the
 * signed token directly, so we jump straight to the reset step. When a provider is
 * configured the API emails a link and we show a "check your inbox" message instead.
 */
export function ForgotPasswordModal({ scope, onClose, accent = "amber" }: { scope: Scope; onClose: () => void; accent?: "amber" | "blue" }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const accentBtn = accent === "blue" ? "bg-blue-600 hover:bg-blue-500" : "bg-amber-500 hover:bg-amber-400 text-black";

  async function requestReset() {
    if (!email.trim()) { setError("Enter your email address"); return; }
    setLoading(true); setError("");
    try {
      const res = scope === "admin"
        ? await api.auth.forgotPassword(email.trim())
        : await restaurantAuth.forgotPassword(email.trim());
      if (res.devToken) {
        setToken(res.devToken);
        setNotice("Demo mode: no email provider configured, so you can set a new password right here.");
        setStep("reset");
      } else {
        setStep("sent");
      }
    } catch (e) {
      setError((e as Error).message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitReset() {
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (!token.trim()) { setError("Reset token is missing. Please request a new link."); return; }
    setLoading(true); setError("");
    try {
      if (scope === "admin") await api.auth.resetPassword(token.trim(), password);
      else await restaurantAuth.resetPassword(token.trim(), password);
      setStep("done");
    } catch (e) {
      setError((e as Error).message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 text-white" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><KeyRound className="h-5 w-5" /> Reset password</h2>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-white/40 hover:text-white" /></button>
        </div>

        {step === "email" && (
          <div className="space-y-3">
            <p className="text-sm text-white/50">Enter your account email and we'll help you set a new password.</p>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void requestReset(); }}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={() => void requestReset()} disabled={loading} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 ${accentBtn}`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send reset link
            </button>
          </div>
        )}

        {step === "reset" && (
          <div className="space-y-3">
            {notice && <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">{notice}</p>}
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
              onKeyDown={e => { if (e.key === "Enter") void submitReset(); }}
              placeholder="Confirm new password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={() => void submitReset()} disabled={loading} className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 ${accentBtn}`}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Set new password
            </button>
          </div>
        )}

        {step === "sent" && (
          <div className="space-y-4 text-center py-4">
            <Mail className="h-12 w-12 mx-auto text-emerald-400" />
            <p className="text-sm text-white/70">If that email is registered, a reset link is on its way. Open it to set a new password (the link expires in 30 minutes).</p>
            <button onClick={onClose} className={`w-full py-3 rounded-xl font-bold text-sm ${accentBtn}`}>Back to login</button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400" />
            <p className="text-sm text-white/70">Password updated. You can now sign in with your new password.</p>
            <button onClick={onClose} className={`w-full py-3 rounded-xl font-bold text-sm ${accentBtn}`}>Back to login</button>
          </div>
        )}
      </div>
    </div>
  );
}
