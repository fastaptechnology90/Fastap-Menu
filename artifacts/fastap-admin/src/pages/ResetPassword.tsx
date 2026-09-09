import { useState } from "react";
import { useLocation } from "wouter";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import { restaurantAuth } from "@/lib/api";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="admin-panel flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-md border bg-card p-6 shadow-sm sm:p-7">
        <div className="mb-5 flex justify-center"><PanelLogo panel="admin" showLabel label="Fastap OS" /></div>
        {done ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="text-lg font-semibold">Password updated</h1>
            <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
            <Button className="w-full" onClick={() => navigate(loginPath)}>Go to login</Button>
          </div>
        ) : (
          <>
            <h1 className="mb-1 flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5" /> Set a new password</h1>
            <p className="mb-5 text-sm text-muted-foreground">Choose a strong password for your account.</p>
            <div className="space-y-3">
              <Input
                type="password"
                autoFocus
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password (min 8 characters)"
                aria-label="New password"
                aria-invalid={!!error || undefined}
              />
              <Input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void submit(); }}
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                aria-invalid={!!error || undefined}
              />
              {error && <p role="alert" className="text-xs text-danger">{error}</p>}
              <Button className="w-full" onClick={() => void submit()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Update password
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate(loginPath)}>Back to login</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
