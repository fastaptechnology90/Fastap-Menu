import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { IMAGES } from "@/lib/media";

export default function Login() {
  const { login, logout, user } = useAuth();
  const SUPER_ADMIN_ROLES = new Set(["super_admin", "finance_admin", "support_admin", "compliance_admin", "sales_admin", "operations_admin"]);
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set when sign-in was refused only because the address has not been confirmed —
  // that is the one failure the user can fix from this screen.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendNote, setResendNote] = useState("");

  // The confirmation link lands back here with the outcome in the query string.
  const verified = new URLSearchParams(window.location.search).get("verified");

  if (user && SUPER_ADMIN_ROLES.has(user.role)) {
    navigate("/dashboard");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendNote("");
    setLoading(true);
    try {
      const loggedIn = await login(email, password);
      if (!SUPER_ADMIN_ROLES.has(loggedIn.role)) {
        await logout();
        setError("This account does not have super admin access. Use the restaurant login instead.");
        return;
      }
      navigate("/dashboard");
    } catch (err: any) {
      if (err?.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendNote("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setResendNote(data.message || "If that address needs confirming, a new link is on its way.");
    } catch {
      setResendNote("Could not reach the server. Try again in a moment.");
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="hidden lg:flex flex-col flex-1 p-12 justify-between relative overflow-hidden">
        <img src={IMAGES.adminMission} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-blue-950/90 to-slate-900/85" />
        <div className="relative">
          <PanelLogo panel="admin" size="lg" showLabel label="Fastap OS" />
          <p className="text-blue-300 text-sm mt-2">Smart Hospitality Operating System</p>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Super Admin<br />Command Center
            </h1>
            <p className="text-blue-200 text-lg leading-relaxed">
              Manage the entire Fastap ecosystem — vendors, payments, compliance, and infrastructure — from one powerful dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {[
              { icon: "storefront", title: "Vendor Management", desc: "Onboard, suspend, and manage all hospitality businesses" },
              { icon: "bar_chart", title: "Financial Control", desc: "Settlements, escrow, commissions, and fraud detection" },
              { icon: "shield", title: "Platform Security", desc: "RBAC, KYC compliance, audit logs, and real-time monitoring" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                  <Icon name={icon} size={22} className="text-blue-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-blue-300 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-blue-400 text-xs">
          © 2026 Fastap Smart Hospitality OS. All rights reserved.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden mb-6">
            <PanelLogo panel="admin" showLabel label="Fastap OS" />
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Sign in to the Super Admin Panel</p>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon name="lock" size={18} />
                <CardDescription>Restricted — Super Admin access only</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {verified === "ok" && (
                  <Alert className="border-emerald-500/50 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Email confirmed. You can sign in now.
                    </AlertDescription>
                  </Alert>
                )}
                {verified === "expired" && (
                  <Alert variant="destructive" className="border-destructive/50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      That confirmation link has expired. Enter your email below and ask for a new one.
                    </AlertDescription>
                  </Alert>
                )}
                {verified === "invalid" && (
                  <Alert variant="destructive" className="border-destructive/50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      That confirmation link is not valid — it may already have been used.
                    </AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant="destructive" className="border-destructive/50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {needsVerification && (
                  <div className="rounded-md border border-border/60 bg-muted/40 p-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleResend}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Send the confirmation email again
                    </Button>
                    {resendNote && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">{resendNote}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Icon name="mail" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@fastap.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Icon name="lock" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating…
                    </>
                  ) : (
                    <>
                      <Icon name="shield" size={18} className="mr-2" />
                      Sign In to Admin Panel
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-dashed border-border/50 bg-muted/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground text-center font-medium mb-3">First time? Set up the super admin account:</p>
              <SetupForm />
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            Restaurant staff?{" "}
            <Link href="/restaurant/login" className="text-primary font-semibold hover:underline">
              Role-based staff login
            </Link>
            {" · "}
            <Link href="/restaurant/register" className="text-primary font-semibold hover:underline">
              Register restaurant
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SetupForm() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/setup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Setup failed"); return; }
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setOpen(true)}>
        Create Super Admin Account
      </Button>
    );
  }

  return (
    <form onSubmit={handleSetup} className="space-y-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required className="h-8 text-xs" />
      <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="h-8 text-xs" />
      <Input type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="h-8 text-xs" />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" className="flex-1 text-xs h-8" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" className="flex-1 text-xs h-8" disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create & Sign In"}
        </Button>
      </div>
    </form>
  );
}
