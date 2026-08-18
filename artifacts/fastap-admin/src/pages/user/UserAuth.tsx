import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { getDeviceId } from "@/lib/smartEntry";
import {
  Smartphone, Mail, Lock, Chrome, Apple, User2, ArrowRight,
  ChevronLeft, Shield, CheckCircle, Eye, EyeOff, UserPlus, Zap,
} from "lucide-react";
import { GuestBackButton, GuestLogo } from "@/components/user/GuestUI";
import { GuestEmpty, GuestVenuePicker } from "@/components/user/GuestApiState";
import { useGuestBack } from "@/hooks/useGuestBack";
import { resolveGuestSlug, withGuestQuery } from "@/lib/guestDemo";

type Mode = "select" | "otp-input" | "otp-verify" | "email" | "register" | "guest" | "guest-type" | "social";
type GuestTypeId = "regular" | "vip" | "corporate" | "hotel" | "membership" | "event";

export default function UserAuth() {
  const [, navigate] = useAppLocation();
  const goBack = useGuestBack();
  const { setUser, venue, refreshUser, loadVenue } = useUser();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("select");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [guestTypes, setGuestTypes] = useState<{ id: GuestTypeId; label: string; desc: string }[]>([]);
  const [selectedGuestType, setSelectedGuestType] = useState<GuestTypeId>("regular");
  const [oneTapAvailable, setOneTapAvailable] = useState(false);
  const [socialProvider, setSocialProvider] = useState<"google" | "apple" | null>(null);
  const [socialName, setSocialName] = useState("");
  const [socialEmail, setSocialEmail] = useState("");
  const [oauthReady, setOauthReady] = useState<{ google: boolean; apple: boolean } | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [venues, setVenues] = useState<{ id: number; name: string; slug: string; publicationStatus?: string }[]>([]);
  const [venuesLoaded, setVenuesLoaded] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState("");

  async function afterAuth(path: string) {
    const params = new URLSearchParams(window.location.search);
    const slug = resolveGuestSlug(selectedSlug || venue.restaurantSlug || undefined);
    if (!slug) {
      setError("Please select a venue first.");
      return;
    }
    if (!venue.restaurantId) {
      try {
        await loadVenue(slug, {
          table: params.get("table") || undefined,
          room: params.get("room") || undefined,
        });
      } catch {
        /* GuestVenueRequired retries on the target page */
      }
    }
    navigate(withGuestQuery(path, venue));
  }

  useEffect(() => {
    publicApi.auth.guestTypes().then(r => setGuestTypes(r.types as typeof guestTypes)).catch(() => {});
    publicApi.auth.oauthConfig().then(r => setOauthReady({ google: r.google, apple: r.apple })).catch(() => {});
    publicApi.venues().then(r => {
      const list = Array.isArray(r.venues) ? r.venues : [];
      setVenues(list);
      const fromUrl = resolveGuestSlug();
      const initial = fromUrl || (list.length === 1 ? list[0].slug : "");
      if (initial) {
        setSelectedSlug(initial);
        loadVenue(initial).catch(() => {});
      }
    }).catch(() => setVenues([])).finally(() => setVenuesLoaded(true));
    const savedPhone = localStorage.getItem("fastap_trusted_phone");
    if (savedPhone) setOneTapAvailable(true);
  }, [loadVenue]);

  async function pickVenue(slug: string) {
    setSelectedSlug(slug);
    setError("");
    try {
      await loadVenue(slug);
    } catch {
      setError("Could not load selected venue.");
    }
  }

  function handleOtpChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) {
      const el = document.getElementById(`otp-${i + 1}`);
      el?.focus();
    }
  }

  function openSocial(provider: "google" | "apple") {
    setSocialProvider(provider);
    setSocialName(provider === "google" ? "" : "");
    setSocialEmail("");
    setMode("social");
  }

  async function socialLoginSubmit() {
    if (!socialProvider || !socialEmail) return;
    setLoading(true);
    setError("");
    try {
      const data = await publicApi.auth.social({
        provider: socialProvider,
        name: socialName || (socialProvider === "google" ? "Google User" : "Apple User"),
        email: socialEmail,
        providerId: `${socialProvider}-${Date.now()}`,
        restaurantId: venue.restaurantId ?? undefined,
        guestType: selectedGuestType,
      });
      setUser(data.user);
      await refreshUser();
      afterAuth("/user/profile");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Social login failed");
    } finally {
      setLoading(false);
    }
  }

  async function oneTapLogin() {
    const phone = localStorage.getItem("fastap_trusted_phone");
    if (!phone) return;
    setLoading(true);
    setError("");
    try {
      const data = await publicApi.auth.oneTap({
        phone,
        deviceId: getDeviceId(),
        restaurantId: venue.restaurantId ?? undefined,
      });
      setUser(data.user);
      await refreshUser();
      afterAuth("/user/profile");
    } catch (e: unknown) {
      const err = e as { message?: string; requiresOtp?: boolean };
      if (err.requiresOtp) setMode("otp-input");
      setError(err.message || "One-tap login failed");
    } finally {
      setLoading(false);
    }
  }

  async function registerSubmit() {
    setLoading(true);
    setError("");
    try {
      const data = await publicApi.auth.register({
        email,
        password,
        name: regName || "User",
        phone: regPhone.replace(/\D/g, "") || undefined,
        restaurantId: venue.restaurantId ?? undefined,
      });
      if (selectedGuestType !== "regular") {
        await publicApi.auth.setGuestType(selectedGuestType);
      }
      setUser(data.user);
      await refreshUser();
      afterAuth("/user/profile");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendOtp() {
    if (!mobile) return;
    setLoading(true);
    setError("");
    try {
      const phone = mobile.replace(/\D/g, "");
      const result = await publicApi.auth.sendOtp(phone);
      if (result.devOtp) setDevOtpHint(result.devOtp);
      setMode("otp-verify");
    } catch (e: any) {
      setError(e.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtpSubmit() {
    const code = otp.join("");
    if (code.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const phone = mobile.replace(/\D/g, "");
      const data = await publicApi.auth.verifyOtp({
        phone,
        otp: code,
        restaurantId: venue.restaurantId ?? undefined,
      });
      localStorage.setItem("fastap_trusted_phone", phone);
      if (selectedGuestType !== "regular") {
        await publicApi.auth.setGuestType(selectedGuestType);
        data.user = (await publicApi.auth.me())?.user ?? data.user;
      }
      setUser(data.user);
      await refreshUser();
      const deviceId = getDeviceId();
      publicApi.auth.trustDevice(deviceId).catch(() => {});
      afterAuth("/user/profile");
    } catch (e: any) {
      setError(e.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function emailLoginSubmit() {
    setLoading(true);
    setError("");
    try {
      const data = await publicApi.auth.emailLogin({
        email,
        password,
        restaurantId: venue.restaurantId ?? undefined,
      });
      setUser(data.user);
      await refreshUser();
      afterAuth("/user/profile");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function guestLoginSubmit() {
    setLoading(true);
    setError("");
    try {
      const data = await publicApi.auth.guest({
        name: guestName || "Guest",
        restaurantId: venue.restaurantId ?? undefined,
      });
      setUser(data.user);
      await refreshUser();
      afterAuth("/user/menu");
    } catch (e: any) {
      setError(e.message || "Guest login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-white flex flex-col px-4 py-12">
      <div className="w-full max-w-sm mx-auto mb-4">
        <GuestBackButton onClick={() => (mode === "select" ? goBack() : setMode("select"))} />
      </div>
      <div className="w-full max-w-sm mx-auto flex-1 flex items-center justify-center">
        <div className="w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <GuestLogo size="lg" />
          </div>
          <h1 className="font-display text-2xl font-bold">Welcome to FastMenu</h1>
          <p className="text-white/50 text-sm mt-1">Sign in to unlock personalized dining</p>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          {venuesLoaded && venues.length === 0 && (
            <div className="mt-4">
              <GuestEmpty
                title="No restaurants found"
                message="No venue data is available yet. Register a restaurant to enable guest menus."
                actionLabel="Register a restaurant"
                onAction={() => navigate("/restaurant/register")}
              />
            </div>
          )}
          {venues.length > 0 && (
            <div className="mt-3 text-left">
              <label className="text-[11px] text-white/45 block mb-1.5">Venue</label>
              <select
                value={selectedSlug}
                onChange={e => { pickVenue(e.target.value).catch(() => {}); }}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500/50"
              >
                <option value="">Select venue</option>
                {venues.map(v => (
                  <option key={v.slug} value={v.slug}>{v.name} ({v.slug})</option>
                ))}
              </select>
            </div>
          )}
          {mode === "select" && (
            <p className="text-white/35 text-xs mt-3 leading-relaxed">
              Demo: OTP <span className="text-white/55">9876543210</span> / <span className="text-white/55">123456</span>
              {" · "}Email <span className="text-white/55">rahul@example.com</span> / <span className="text-white/55">Demo@123</span>
            </p>
          )}
        </div>

        {mode === "select" && (
          <div className="space-y-3">
            {oneTapAvailable && (
              <button
                onClick={oneTapLogin}
                disabled={loading}
                className="w-full flex items-center gap-4 rounded-xl border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 transition-all p-4"
              >
                <div className="h-10 w-10 rounded-lg bg-orange-500/30 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-orange-300" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-sm font-semibold">One-Tap Login</div>
                  <div className="text-xs text-white/40">Trusted device — instant sign in</div>
                </div>
                <ArrowRight className="h-4 w-4 text-white/30" />
              </button>
            )}

            <button
              onClick={() => setMode("otp-input")}
              className="guest-card guest-card-interactive w-full flex items-center gap-4 p-4"
            >
              <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-orange-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold">Mobile OTP Login</div>
                <div className="text-xs text-white/40">Quick & secure</div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30" />
            </button>

            <button
              onClick={() => setMode("email")}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all p-4"
            >
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold">Email & Password</div>
                <div className="text-xs text-white/40">Classic login</div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30" />
            </button>

            <button
              onClick={() => openSocial("google")}
              disabled={loading}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all p-4"
            >
              <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Chrome className="h-5 w-5 text-red-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold">Continue with Google</div>
                <div className="text-xs text-white/40">One-tap login</div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30" />
            </button>

            <button
              onClick={() => openSocial("apple")}
              disabled={loading}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all p-4"
            >
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Apple className="h-5 w-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold">Continue with Apple</div>
                <div className="text-xs text-white/40">Sign in with Apple ID</div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30" />
            </button>

            <button
              onClick={() => setMode("register")}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all p-4"
            >
              <div className="h-10 w-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-teal-400" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold">Create Account</div>
                <div className="text-xs text-white/40">Register with email</div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30" />
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs text-white/30">
                <span className="bg-[#0b1120] px-3">or</span>
              </div>
            </div>

            <button
              onClick={() => setMode("guest-type")}
              className="w-full flex items-center gap-4 rounded-xl border border-dashed border-white/10 bg-transparent hover:bg-white/5 transition-all p-4"
            >
              <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center">
                <User2 className="h-5 w-5 text-white/40" />
              </div>
              <div className="text-left flex-1">
                <div className="text-sm font-semibold text-white/70">Continue as Guest</div>
                <div className="text-xs text-white/30">Limited features, no sign-up</div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/20" />
            </button>
          </div>
        )}

        {/* OTP Input */}
        {mode === "otp-input" && (
          <div className="space-y-5">
            <button onClick={() => setMode("select")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-2">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h2 className="text-xl font-bold mb-1">Enter your mobile</h2>
              <p className="text-white/40 text-sm">We'll send a 6-digit OTP to verify</p>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="flex items-center px-4 border-r border-white/10 text-sm text-white/50">🇮🇳 +91</div>
              <input
                className="flex-1 bg-transparent px-4 py-3.5 text-sm focus:outline-none"
                placeholder="98765 43210"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
              />
            </div>
            <button
              onClick={sendOtp}
              disabled={mobile.length !== 10 || loading}
              className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 font-semibold text-sm transition-all"
            >
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </div>
        )}

        {/* OTP Verify */}
        {mode === "otp-verify" && (
          <div className="space-y-6">
            <button onClick={() => setMode("otp-input")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Change number
            </button>
            <div>
              <h2 className="text-xl font-bold mb-1">Verify OTP</h2>
              <p className="text-white/40 text-sm">Sent to +91 {mobile.slice(0, 5)}xxxxx</p>
              {devOtpHint && (
                <p className="text-orange-300/90 text-xs mt-2">Demo OTP: <span className="font-mono font-semibold">{devOtpHint}</span></p>
              )}
            </div>
            <div className="flex gap-2 justify-between">
              {otp.map((v, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  className="w-12 h-12 text-center text-lg font-bold rounded-xl border border-white/10 bg-white/5 focus:border-orange-500 focus:outline-none transition-colors"
                  maxLength={1}
                  value={v}
                  onChange={e => handleOtpChange(i, e.target.value)}
                />
              ))}
            </div>
            <button
              onClick={verifyOtpSubmit}
              disabled={otp.some(v => !v) || loading}
              className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Shield className="h-4 w-4" /> Verify & Continue</>}
            </button>
            <p className="text-center text-xs text-white/30">Resend OTP in 30s</p>
          </div>
        )}

        {/* Email Login */}
        {mode === "email" && (
          <div className="space-y-5">
            <button onClick={() => setMode("select")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h2 className="text-xl font-bold mb-1">Email Login</h2>
              <p className="text-white/40 text-sm">Enter your credentials</p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-orange-500/50"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-11 py-3.5 text-sm focus:outline-none focus:border-orange-500/50"
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              onClick={emailLoginSubmit}
              disabled={!email || !password || loading}
              className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 font-semibold text-sm"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Social login profile */}
        {mode === "social" && socialProvider && (
          <div className="space-y-5">
            <button onClick={() => setMode("select")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h2 className="text-xl font-bold mb-1">Continue with {socialProvider === "google" ? "Google" : "Apple"}</h2>
              <p className="text-white/40 text-sm">
                {oauthReady && !oauthReady[socialProvider]
                  ? "Native OAuth is not configured — enter your account email to link your profile."
                  : "Confirm your account details"}
              </p>
            </div>
            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm" placeholder="Full name" value={socialName} onChange={e => setSocialName(e.target.value)} />
            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm" placeholder="Email address" type="email" value={socialEmail} onChange={e => setSocialEmail(e.target.value)} />
            <button onClick={socialLoginSubmit} disabled={!socialEmail || loading} className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-40 font-semibold text-sm">
              {loading ? "Signing in…" : "Complete Sign In"}
            </button>
          </div>
        )}

        {/* Guest Type Selection */}
        {mode === "guest-type" && (
          <div className="space-y-4">
            <button onClick={() => setMode("select")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h2 className="text-xl font-bold mb-1">Guest Profile Type</h2>
              <p className="text-white/40 text-sm">Select your guest category for personalized service</p>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(guestTypes.length ? guestTypes : [
                { id: "regular" as const, label: "Regular Guest", desc: "Standard dining" },
                { id: "vip" as const, label: "VIP Guest", desc: "Priority service" },
                { id: "hotel" as const, label: "Hotel Guest", desc: "Room & resort services" },
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedGuestType(t.id as GuestTypeId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedGuestType === t.id ? "bg-orange-500/20 border-orange-500/50" : "bg-white/5 border-white/10"}`}
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-white/40">{t.desc}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setMode("guest")} className="w-full py-3.5 rounded-xl bg-orange-500 font-semibold text-sm">
              Continue as Guest
            </button>
          </div>
        )}

        {/* Register */}
        {mode === "register" && (
          <div className="space-y-5">
            <button onClick={() => setMode("select")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h2 className="text-xl font-bold mb-1">Create Account</h2>
              <p className="text-white/40 text-sm">Register to save orders & earn rewards</p>
            </div>
            <div className="space-y-3">
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm" placeholder="Full name" value={regName} onChange={e => setRegName(e.target.value)} />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm" placeholder="Mobile (optional)" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm" placeholder="Password (min 6 chars)" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button onClick={registerSubmit} disabled={!email || password.length < 6 || loading} className="w-full py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 font-semibold text-sm">
              {loading ? "Creating…" : "Create Account"}
            </button>
          </div>
        )}

        {/* Guest Login */}
        {mode === "guest" && (
          <div className="space-y-5">
            <button onClick={() => setMode("select")} className="flex items-center gap-2 text-sm text-white/50 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div>
              <h2 className="text-xl font-bold mb-1">Continue as Guest</h2>
              <p className="text-white/40 text-sm">Your name helps us personalise service</p>
            </div>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-orange-500/50"
              placeholder="Your name (optional)"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
            />
            <button
              onClick={guestLoginSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-sm"
            >
              Browse as Guest
            </button>
            <div className="flex items-start gap-2 text-xs text-white/30 bg-white/5 rounded-xl p-3">
              <CheckCircle className="h-3.5 w-3.5 mt-0.5 text-orange-400 flex-shrink-0" />
              Guest access lets you view menus and place orders. Sign in to earn loyalty points and access order history.
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
