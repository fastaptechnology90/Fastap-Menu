import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRestaurant, type StaffRole } from "@/contexts/RestaurantContext";
import { restaurantAuth } from "@/lib/api";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { ForgotPasswordModal } from "@/components/shared/ForgotPasswordModal";
import { IMAGES } from "@/lib/media";
import { ArrowLeft } from "lucide-react";
import {
  RESTAURANT_LOGIN_ROLES,
  defaultPathForRole,
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
      const err = e as Error & { restaurants?: VenueOption[] };
      if (err.restaurants?.length) {
        setVenueOptions(err.restaurants);
        setError("Select your restaurant to continue");
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

  return (
    <div className="restaurant-panel min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={IMAGES.heroKitchen} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,5%)] via-[hsl(222,47%,5%)]/80 to-transparent" />
        <div className="relative p-12 flex flex-col justify-end">
          <PanelLogo panel="restaurant" size="lg" showLabel label="FastMenu" />
          <h2 className="font-display text-3xl font-semibold mt-8 mb-3">Restaurant Manager Portal</h2>
          <p className="text-muted-foreground max-w-md mb-6">12 staff roles — owner, manager, cashier, waiter, kitchen, reception, finance, and more. Each role sees only what they need.</p>
          <div className="flex flex-wrap gap-2">
            {RESTAURANT_LOGIN_ROLES.slice(0, 6).map(r => (
              <span key={r.role} className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border">{r.icon} {r.label}</span>
            ))}
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">+6 more</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6 lg:hidden">
            <div className="flex justify-center mb-4"><PanelLogo panel="restaurant" size="lg" /></div>
            <h1 className="font-display text-2xl font-semibold">Staff Login</h1>
            <p className="text-sm text-muted-foreground mt-1">Select your role, then sign in</p>
          </div>

          {/* Role picker */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">Select your role</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {RESTAURANT_LOGIN_ROLES.map(opt => (
                <button
                  key={opt.role}
                  type="button"
                  onClick={() => pickRole(opt.role)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-colors ${
                    selectedRole === opt.role
                      ? "border-primary/60 bg-primary/15"
                      : "border-border bg-muted hover:border-border hover-elevate"
                  }`}
                >
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className="text-2xs sm:text-xs font-semibold text-foreground leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            {activeRole && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {activeRole.description}
              </p>
            )}
          </div>

          {venueOptions && venueOptions.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-primary font-semibold uppercase">Select your restaurant</p>
              {venueOptions.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setSelectedRestaurantId(v.id); setVenueOptions(null); setError(""); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${selectedRestaurantId === v.id ? "border-primary/50 bg-primary/15" : "border-border bg-muted hover:border-border"}`}
                >
                  <Icon name="restaurant" size={20} className="text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{v.name}</p>
                    {v.address && <p className="text-xs text-muted-foreground">{v.address}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1 bg-muted p-1 rounded-lg mb-4">
            <button
              type="button"
              onClick={() => { setLoginMethod("password"); setStep("form"); setError(""); pickRole(selectedRole); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${loginMethod === "password" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("otp"); setStep("form"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${loginMethod === "otp" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mobile OTP
            </button>
          </div>

          {step === "form" && loginMethod === "password" && (
            <div className="space-y-3">
              <input
                className="w-full bg-muted border border-border rounded-lg px-4 py-3.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
                placeholder="Staff email address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <div className="relative">
                <input
                  className="w-full bg-muted border border-border rounded-lg px-4 pr-11 py-3.5 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground"
                  placeholder="Password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <Icon name={showPass ? "visibility_off" : "visibility"} size={20} />
                </button>
              </div>
            </div>
          )}

          {step === "form" && loginMethod === "otp" && (
            <div className="flex rounded-lg border border-border bg-muted overflow-hidden focus-within:border-primary/50">
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="bg-transparent px-3 py-3.5 text-sm text-foreground border-r border-border focus:outline-none cursor-pointer max-w-[130px]"
                aria-label="Country code"
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code + c.name} value={c.code} className="bg-muted text-foreground">
                    {c.code} {c.iso}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 min-w-0 bg-transparent px-4 py-3.5 text-sm focus:outline-none placeholder:text-muted-foreground"
                placeholder="Registered mobile number"
                inputMode="numeric"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 15))}
                maxLength={15}
              />
            </div>
          )}

          {step === "otp-verify" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the OTP sent to {countryCode} {mobile.slice(0, 5)}xxxxx</p>
              <div className="flex gap-2 justify-between">
                {otp.map((v, i) => (
                  <input
                    key={i}
                    id={`r-otp-${i}`}
                    className="w-12 h-12 text-center text-lg font-semibold rounded-lg border border-border bg-muted focus:border-primary focus:outline-none"
                    maxLength={1}
                    value={v}
                    onChange={e => handleOtpChange(i, e.target.value)}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setStep("form")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Change number</button>
            </div>
          )}

          {error && <p className="text-xs text-danger mt-3 px-1">{error}</p>}

          <button
            type="button"
            onClick={() => {
              if (loginMethod === "otp" && step === "form") void sendOtp();
              else void handleLogin();
            }}
            disabled={loading}
            className="w-full mt-4 py-4 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 font-semibold text-sm shadow-xl flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-border border-t-white rounded-full animate-spin" />
            ) : loginMethod === "otp" && step === "form" ? (
              "Send OTP"
            ) : (
              <><Icon name="login" size={18} /> Sign in as {activeRole?.label ?? "Staff"}</>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary font-medium"
          >
            Forgot password?
          </button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            New restaurant?{" "}
            <Link href="/restaurant/register" className="text-primary hover:text-primary font-semibold">
              Register with KYC
            </Link>
          </p>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal scope="staff" accent="amber" onClose={() => setShowForgot(false)} />}
    </div>
  );
}
