/**
 * Restaurant staff sign-in.
 *
 * Rebuilt on the public site's design language (`.fastap-site`) rather than the
 * dark panel theme: this is a page people meet before they are inside the
 * product, and it should look like the landing page they arrived from.
 *
 * A split layout — photograph on the left from `lg` up, form on the right. The
 * form column is the only thing that exists below `lg`, because this gets opened
 * on a phone at a counter with a queue behind it.
 *
 * The sign-in logic is unchanged: role picker, email/password or mobile OTP,
 * multi-venue disambiguation, subscription gate, and the `?next=` return path.
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRestaurant, type StaffRole } from "@/contexts/RestaurantContext";
import { restaurantAuth } from "@/lib/api";
import { SiteBrand } from "@/components/site/SiteBrand";
import { ForgotPasswordModal } from "@/components/shared/ForgotPasswordModal";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Store, Loader2 } from "lucide-react";
import {
  RESTAURANT_LOGIN_ROLES,
  defaultPathForRole,
  devDemoCredentialsForRole,
} from "@/config/restaurantLoginRoles";

type LoginMethod = "password" | "otp";

// Country dial codes for the phone/OTP login. `len` = expected national number length
// (used for light validation; 0 = flexible).
const COUNTRY_CODES: { code: string; iso: string; name: string; len: number }[] = [
  { code: "+91", iso: "IN", name: "India", len: 10 },
  { code: "+971", iso: "AE", name: "UAE", len: 9 },
  { code: "+966", iso: "SA", name: "Saudi Arabia", len: 9 },
  { code: "+1", iso: "US", name: "USA / Canada", len: 10 },
  { code: "+44", iso: "GB", name: "UK", len: 10 },
  { code: "+65", iso: "SG", name: "Singapore", len: 8 },
  { code: "+61", iso: "AU", name: "Australia", len: 9 },
  { code: "+92", iso: "PK", name: "Pakistan", len: 10 },
  { code: "+880", iso: "BD", name: "Bangladesh", len: 10 },
  { code: "+977", iso: "NP", name: "Nepal", len: 10 },
  { code: "+94", iso: "LK", name: "Sri Lanka", len: 9 },
  { code: "+49", iso: "DE", name: "Germany", len: 0 },
  { code: "+33", iso: "FR", name: "France", len: 9 },
  { code: "+81", iso: "JP", name: "Japan", len: 0 },
  { code: "+86", iso: "CN", name: "China", len: 11 },
];

interface VenueOption {
  id: number;
  name: string;
  slug: string;
  address?: string;
  businessType?: string;
}

// Reads a ?next= target from the URL and only allows an in-panel restaurant path (never the
// login/subscription pages), so a deep-linked app returns to its own screen after login.
function safeNextPath(): string | null {
  try {
    const p = new URLSearchParams(window.location.search).get("next");
    if (!p) return null;
    const dec = decodeURIComponent(p);
    if (dec.startsWith("/restaurant/")
      && !dec.startsWith("/restaurant/login")
      && !dec.startsWith("/restaurant/subscription")) {
      return dec;
    }
  } catch { /* ignore malformed next */ }
  return null;
}

export default function RestaurantLogin() {
  const [, navigate] = useLocation();
  const { loginStaff } = useRestaurant();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [selectedRole, setSelectedRole] = useState<StaffRole>("manager");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showPass, setShowPass] = useState(false);
  const [step, setStep] = useState<"form" | "otp-verify">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [venueOptions, setVenueOptions] = useState<VenueOption[] | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  function pickRole(role: StaffRole) {
    setSelectedRole(role);
    setError("");
    // Production builds never pre-fill — credentials only exist behind Vite DEV.
    const demo = devDemoCredentialsForRole(role);
    if (demo && loginMethod === "password") {
      setEmail(demo.email);
      setPassword(demo.password);
    } else if (!import.meta.env.DEV) {
      setEmail("");
      setPassword("");
    }
  }

  function handleOtpChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) document.getElementById(`r-otp-${i + 1}`)?.focus();
  }

  async function sendOtp() {
    const phone = mobile.replace(/\D/g, "");
    const country = COUNTRY_CODES.find(c => c.code === countryCode);
    const expected = country?.len ?? 0;
    if (expected > 0 ? phone.length !== expected : phone.length < 6) {
      setError(expected > 0
        ? `Enter a valid ${expected}-digit ${country?.name ?? ""} number`
        : "Enter a valid mobile number");
      return;
    }
    setLoading(true);
    setError("");
    setVenueOptions(null);
    try {
      await restaurantAuth.sendOtp({
        phone,
        countryCode,
        restaurantId: selectedRestaurantId ?? undefined,
      });
      setStep("otp-verify");
    } catch (e: unknown) {
      const err = e as Error & { restaurants?: VenueOption[]; detail?: { code?: string }; status?: number };
      if (err.restaurants?.length) {
        setVenueOptions(err.restaurants);
        setError("Select your restaurant to continue");
      } else if (err.detail?.code === "SMS_NOT_CONNECTED" || err.detail?.code === "SMS_SEND_FAILED" || err.status === 503) {
        setError(err.message || "Phone OTP is not available. Sign in with email and password.");
        setLoginMethod("password");
        setStep("form");
      } else {
        setError(err.message || "Failed to send OTP");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (loginMethod === "password" && (!email.trim() || !password)) {
      setError("Email and password are required");
      return;
    }
    if (loginMethod === "otp" && otp.join("").length < 6) {
      setError("Enter the 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");
    try {
      let result;
      if (loginMethod === "password") {
        result = await loginStaff({
          restaurantId: selectedRestaurantId ?? undefined,
          email: email.trim(),
          password,
        });
      } else {
        result = await loginStaff({
          restaurantId: selectedRestaurantId ?? undefined,
          phone: mobile.replace(/\D/g, ""),
          otp: otp.join(""),
        });
      }
      const role = result?.staff?.role || selectedRole;
      if (result?.requiresSubscription || !result?.subscription?.active) {
        navigate("/restaurant/subscription");
      } else {
        // If the app was opened at a specific screen (e.g. the Kitchen app → /restaurant/kitchen)
        // return there; otherwise fall back to the role's default page.
        navigate(safeNextPath() || defaultPathForRole(role));
      }
    } catch (e: unknown) {
      const err = e as Error & { restaurants?: VenueOption[] };
      if (err.restaurants?.length) {
        setVenueOptions(err.restaurants);
        setError("Select your restaurant to continue");
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  const activeRole = RESTAURANT_LOGIN_ROLES.find(r => r.role === selectedRole);
  const primaryLabel = loginMethod === "otp" && step === "form"
    ? "Send OTP"
    : `Sign in as ${activeRole?.label ?? "staff"}`;

  return (
    <div className="fastap-site flex min-h-dvh flex-col lg:flex-row">
      {/* ------------------------------------------------- artwork (lg only) */}
      <aside className="relative isolate hidden overflow-hidden lg:flex lg:w-[44%] lg:shrink-0">
        <img
          src="/img/cafe-counter.webp"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(12,10,10,0.78) 0%, rgba(12,10,10,0.70) 40%, rgba(12,10,10,0.92) 100%)",
          }}
        />
        <div className="flex w-full flex-col justify-between p-12">
          <Link href="/" className="inline-flex w-fit">
            <SiteBrand size="lg" onDark />
          </Link>

          <div>
            <h2 className="fs-display-xl text-4xl text-white xl:text-5xl">
              Welcome back to
              <br />
              <span style={{ color: "#ff8a8f" }}>your counter.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
              Twelve roles, one sign-in. Everybody who works here gets the screen
              they need and nothing they do not.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {RESTAURANT_LOGIN_ROLES.slice(0, 7).map(r => (
                <span
                  key={r.role}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 ring-1 ring-inset ring-white/15"
                >
                  {r.label}
                </span>
              ))}
              <span className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/55">
                +{Math.max(0, RESTAURANT_LOGIN_ROLES.length - 7)} more
              </span>
            </div>
          </div>

          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} Fastap OS
          </p>
        </div>
      </aside>

      {/* ---------------------------------------------------------- the form */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex">
              <SiteBrand />
            </Link>
          </div>

          <h1 className="fs-display text-3xl text-foreground sm:text-4xl">Sign in</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            For everyone who works at the restaurant — owner, manager, counter and kitchen.
          </p>

          {/* Role picker. Determines the screen you land on, and pre-fills nothing
              outside a dev build. */}
          <div className="mt-7">
            <span className="fs-label">Your role</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {RESTAURANT_LOGIN_ROLES.map(opt => (
                <button
                  key={opt.role}
                  type="button"
                  onClick={() => pickRole(opt.role)}
                  aria-pressed={selectedRole === opt.role}
                  className={`rounded-xl border-2 px-2 py-2.5 text-center text-xs font-semibold transition-colors ${
                    selectedRole === opt.role
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {activeRole?.description && (
              <p className="mt-2 text-xs text-muted-foreground">{activeRole.description}</p>
            )}
          </div>

          {/* Same mobile number at more than one venue — say which. */}
          {venueOptions && venueOptions.length > 0 && (
            <div className="mt-6 space-y-2">
              <span className="fs-label">Which restaurant?</span>
              {venueOptions.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setSelectedRestaurantId(v.id); setVenueOptions(null); setError(""); }}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    selectedRestaurantId === v.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  <Store className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{v.name}</span>
                    {v.address && <span className="block truncate text-xs text-muted-foreground">{v.address}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Method switch */}
          <div className="mt-6 flex gap-1 rounded-full bg-muted p-1">
            {([
              ["password", "Email & password"],
              ["otp", "Mobile OTP"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setLoginMethod(id);
                  setStep("form");
                  setError("");
                  if (id === "password") pickRole(selectedRole);
                }}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors ${
                  loginMethod === id
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            className="mt-6"
            onSubmit={e => {
              e.preventDefault();
              if (loginMethod === "otp" && step === "form") void sendOtp();
              else void handleLogin();
            }}
          >
            {step === "form" && loginMethod === "password" && (
              <div className="space-y-4">
                <div>
                  <label className="fs-label" htmlFor="r-email">Staff email address</label>
                  <input
                    id="r-email"
                    className="fs-field"
                    placeholder="you@yourrestaurant.com"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="fs-label" htmlFor="r-pass">Password</label>
                  <div className="relative">
                    <input
                      id="r-pass"
                      className="fs-field pr-12"
                      placeholder="Your password"
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      aria-label={showPass ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === "form" && loginMethod === "otp" && (
              <div>
                <label className="fs-label" htmlFor="r-mobile">Registered mobile number</label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    className="fs-field max-w-[7.5rem] cursor-pointer"
                    aria-label="Country code"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code + c.name} value={c.code}>{c.code} {c.iso}</option>
                    ))}
                  </select>
                  <input
                    id="r-mobile"
                    className="fs-field flex-1"
                    placeholder="98765 43210"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 15))}
                    maxLength={15}
                  />
                </div>
              </div>
            )}

            {step === "otp-verify" && (
              <div>
                <label className="fs-label">
                  Enter the code sent to {countryCode} {mobile.slice(0, 5)}xxxxx
                </label>
                <div className="flex gap-2">
                  {otp.map((v, i) => (
                    <input
                      key={i}
                      id={`r-otp-${i}`}
                      className="fs-field min-w-0 flex-1 px-0 text-center text-lg font-bold"
                      maxLength={1}
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      value={v}
                      onChange={e => handleOtpChange(i, e.target.value)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" /> Change number
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-danger-border bg-danger-subtle px-3.5 py-2.5 text-sm text-danger">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="fs-cta mt-6 w-full disabled:opacity-50">
              {loading
                ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                : <>{primaryLabel} <ArrowRight className="h-5 w-5" aria-hidden="true" /></>}
            </button>
          </form>

          <div className="mt-6 space-y-2.5 text-center text-sm">
            <p>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="font-semibold text-primary underline underline-offset-2"
              >
                Forgotten your password?
              </button>
            </p>
            <p className="text-muted-foreground">
              No account yet?{" "}
              <Link href="/restaurant/register" className="font-semibold text-primary underline underline-offset-2">
                Register your restaurant
              </Link>
            </p>
          </div>
        </div>
      </main>

      {showForgot && <ForgotPasswordModal scope="staff" accent="amber" onClose={() => setShowForgot(false)} />}
    </div>
  );
}
