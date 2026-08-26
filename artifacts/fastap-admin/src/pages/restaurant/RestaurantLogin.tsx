import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRestaurant, type StaffRole } from "@/contexts/RestaurantContext";
import { restaurantAuth } from "@/lib/api";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { ForgotPasswordModal } from "@/components/shared/ForgotPasswordModal";
import { IMAGES } from "@/lib/media";
import {
  RESTAURANT_LOGIN_ROLES,
  DEMO_STAFF_PASSWORD,
  defaultPathForRole,
} from "@/config/restaurantLoginRoles";

type LoginMethod = "password" | "otp";

// Country dial codes for the phone/OTP login. `len` = expected national number length
// (used for light validation; 0 = flexible).
const COUNTRY_CODES: { code: string; flag: string; name: string; len: number }[] = [
  { code: "+91", flag: "🇮🇳", name: "India", len: 10 },
  { code: "+971", flag: "🇦🇪", name: "UAE", len: 9 },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia", len: 9 },
  { code: "+1", flag: "🇺🇸", name: "USA / Canada", len: 10 },
  { code: "+44", flag: "🇬🇧", name: "UK", len: 10 },
  { code: "+65", flag: "🇸🇬", name: "Singapore", len: 8 },
  { code: "+61", flag: "🇦🇺", name: "Australia", len: 9 },
  { code: "+92", flag: "🇵🇰", name: "Pakistan", len: 10 },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh", len: 10 },
  { code: "+977", flag: "🇳🇵", name: "Nepal", len: 10 },
  { code: "+94", flag: "🇱🇰", name: "Sri Lanka", len: 9 },
  { code: "+49", flag: "🇩🇪", name: "Germany", len: 0 },
  { code: "+33", flag: "🇫🇷", name: "France", len: 9 },
  { code: "+81", flag: "🇯🇵", name: "Japan", len: 0 },
  { code: "+86", flag: "🇨🇳", name: "China", len: 11 },
];

interface VenueOption {
  id: number;
  name: string;
  slug: string;
  address?: string;
  businessType?: string;
}

export default function RestaurantLogin() {
  const [, navigate] = useLocation();
  const { loginStaff } = useRestaurant();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [selectedRole, setSelectedRole] = useState<StaffRole>("manager");
  const [email, setEmail] = useState("manager@spicegarden.com");
  const [password, setPassword] = useState(DEMO_STAFF_PASSWORD);
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
    const opt = RESTAURANT_LOGIN_ROLES.find(r => r.role === role);
    if (opt && loginMethod === "password") {
      setEmail(opt.demoEmail);
      setPassword(DEMO_STAFF_PASSWORD);
    }
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
        navigate(defaultPathForRole(role));
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
          <h2 className="font-display text-3xl font-bold mt-8 mb-3">Restaurant Manager Portal</h2>
          <p className="text-white/55 max-w-md mb-6">12 staff roles — owner, manager, cashier, waiter, kitchen, reception, finance, and more. Each role sees only what they need.</p>
          <div className="flex flex-wrap gap-2">
            {RESTAURANT_LOGIN_ROLES.slice(0, 6).map(r => (
              <span key={r.role} className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/10">{r.icon} {r.label}</span>
            ))}
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-white/40">+6 more</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6 lg:hidden">
            <div className="flex justify-center mb-4"><PanelLogo panel="restaurant" size="lg" /></div>
            <h1 className="font-display text-2xl font-extrabold">Staff Login</h1>
            <p className="text-sm text-white/40 mt-1">Select your role, then sign in</p>
          </div>

          {/* Role picker */}
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-2">Select your role</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {RESTAURANT_LOGIN_ROLES.map(opt => (
                <button
                  key={opt.role}
                  type="button"
                  onClick={() => pickRole(opt.role)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all ${
                    selectedRole === opt.role
                      ? "border-amber-500/60 bg-amber-500/15 shadow-lg shadow-amber-500/10 scale-[1.02]"
                      : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/8"
                  }`}
                >
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className="text-[10px] sm:text-xs font-semibold text-white/90 leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            {activeRole && (
              <p className="text-xs text-white/45 mt-2 text-center">
                {activeRole.description}
                {loginMethod === "password" && (
                  <span className="text-amber-400/80"> · Demo filled — use your venue email or tap another role</span>
                )}
              </p>
            )}
          </div>

          {venueOptions && venueOptions.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-amber-400 font-semibold uppercase">Select your restaurant</p>
              {venueOptions.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setSelectedRestaurantId(v.id); setVenueOptions(null); setError(""); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${selectedRestaurantId === v.id ? "border-amber-500/50 bg-amber-500/15" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                >
                  <Icon name="restaurant" size={20} className="text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{v.name}</p>
                    {v.address && <p className="text-xs text-white/40">{v.address}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => { setLoginMethod("password"); setStep("form"); setError(""); pickRole(selectedRole); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${loginMethod === "password" ? "bg-amber-500 text-white" : "text-white/50 hover:text-white"}`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("otp"); setStep("form"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${loginMethod === "otp" ? "bg-amber-500 text-white" : "text-white/50 hover:text-white"}`}
            >
              Mobile OTP
            </button>
          </div>

          {step === "form" && loginMethod === "password" && (
            <div className="space-y-3">
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-white/30"
                placeholder="Staff email address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <div className="relative">
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 pr-11 py-3.5 text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-white/30"
                  placeholder="Password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                  <Icon name={showPass ? "visibility_off" : "visibility"} size={20} />
                </button>
              </div>
            </div>
          )}

          {step === "form" && loginMethod === "otp" && (
            <div className="flex rounded-xl border border-white/10 bg-white/5 overflow-hidden focus-within:border-amber-500/50">
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="bg-transparent px-3 py-3.5 text-sm text-white/80 border-r border-white/10 focus:outline-none cursor-pointer max-w-[130px]"
                aria-label="Country code"
              >
                {COUNTRY_CODES.map(c => (
                  <option key={c.code + c.name} value={c.code} className="bg-neutral-900 text-white">
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 min-w-0 bg-transparent px-4 py-3.5 text-sm focus:outline-none placeholder:text-white/30"
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
              <p className="text-sm text-white/60">Enter the OTP sent to {countryCode} {mobile.slice(0, 5)}xxxxx</p>
              <div className="flex gap-2 justify-between">
                {otp.map((v, i) => (
                  <input
                    key={i}
                    id={`r-otp-${i}`}
                    className="w-12 h-12 text-center text-lg font-bold rounded-xl border border-white/10 bg-white/5 focus:border-amber-500 focus:outline-none"
                    maxLength={1}
                    value={v}
                    onChange={e => handleOtpChange(i, e.target.value)}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setStep("form")} className="text-sm text-white/40 hover:text-white">← Change number</button>
            </div>
          )}

          {error && <p className="text-xs text-red-400 mt-3 px-1">{error}</p>}

          <button
            type="button"
            onClick={() => {
              if (loginMethod === "otp" && step === "form") void sendOtp();
              else void handleLogin();
            }}
            disabled={loading}
            className="w-full mt-4 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 font-bold text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : loginMethod === "otp" && step === "form" ? (
              "Send OTP"
            ) : (
              <><Icon name="login" size={18} /> Sign in as {activeRole?.label ?? "Staff"}</>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="mt-4 w-full text-center text-sm text-white/50 hover:text-amber-300 font-medium"
          >
            Forgot password?
          </button>

          <p className="mt-4 text-center text-sm text-white/40">
            New restaurant?{" "}
            <Link href="/restaurant/register" className="text-amber-400 hover:text-amber-300 font-semibold">
              Register with KYC
            </Link>
          </p>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal scope="staff" accent="amber" onClose={() => setShowForgot(false)} />}
    </div>
  );
}
