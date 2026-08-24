import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Zap, ArrowRight, ChevronRight, QrCode, BarChart3, Users,
  Shield, CreditCard, Utensils, Star, MapPin, Building2,
  Coffee, Waves, ChefHat, Menu, X, Smartphone, Calendar, Clock,
  Headphones, Wallet, Hotel, Sparkles, Wine, Languages, Wifi, Monitor, Film,
  ShoppingBag, Receipt,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { GuestLogo } from "@/components/user/GuestUI";
import { PhoneMockup } from "@/components/user/PhoneMockup";
import { DEMO_MENU_URL } from "@/lib/guestDemo";

// "Try Demo Menu" / smart-entry chips open the demo menu directly (no login). The demo
// menu is VIEW-ONLY — guests can browse but cannot order or sign in (handled in MenuPage).
const GUEST_ENTRY_PATH = DEMO_MENU_URL;
const smartEntryDemos = [
  { label: "QR Table", path: GUEST_ENTRY_PATH },
  { label: "NFC Tap", path: GUEST_ENTRY_PATH },
  { label: "Room QR", path: GUEST_ENTRY_PATH },
  { label: "Poolside", path: GUEST_ENTRY_PATH },
  { label: "Spa QR", path: GUEST_ENTRY_PATH },
  { label: "Event QR", path: GUEST_ENTRY_PATH },
  { label: "Parking", path: GUEST_ENTRY_PATH },
  { label: "PWA App", path: GUEST_ENTRY_PATH },
];

const FEATURE_COLORS: Record<string, string> = {
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  teal: "bg-teal-500/15 text-teal-400 border-teal-500/25",
  violet: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  amber: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  pink: "bg-pink-500/15 text-pink-400 border-pink-500/25",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  indigo: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
  rose: "bg-rose-500/15 text-rose-400 border-rose-500/25",
};

const userWebFeatures = [
  { icon: QrCode, label: "Digital Menu", desc: "Browse, customize & order", path: GUEST_ENTRY_PATH, color: "orange" },
  { icon: ShoppingBag, label: "Cart & Checkout", desc: "Order, split pay & schedule", path: GUEST_ENTRY_PATH, color: "orange" },
  { icon: Receipt, label: "Smart Dining", desc: "Call waiter, live bill & split", path: GUEST_ENTRY_PATH, color: "rose" },
  { icon: MapPin, label: "Smart Seating", desc: "Live tables & suggestions", path: GUEST_ENTRY_PATH, color: "teal" },
  { icon: Calendar, label: "Reservations", desc: "Table, spa & event booking", path: GUEST_ENTRY_PATH, color: "violet" },
  { icon: Sparkles, label: "Events & Banquet", desc: "Weddings & conferences", path: GUEST_ENTRY_PATH, color: "purple" },
  { icon: Clock, label: "Waitlist", desc: "Join queue & get notified", path: GUEST_ENTRY_PATH, color: "amber" },
  { icon: Smartphone, label: "Live Tracking", desc: "Real-time order status", path: GUEST_ENTRY_PATH, color: "emerald" },
  { icon: Hotel, label: "Room Service", desc: "Hotel guest requests", path: GUEST_ENTRY_PATH, color: "blue" },
  { icon: Sparkles, label: "Spa & Wellness", desc: "Book treatments", path: GUEST_ENTRY_PATH, color: "pink" },
  { icon: Wine, label: "Bar & Nightlife", desc: "Happy hour & cocktails", path: GUEST_ENTRY_PATH, color: "violet" },
  { icon: Wallet, label: "Wallet & Loyalty", desc: "Recharge & transfer", path: GUEST_ENTRY_PATH, color: "yellow" },
  { icon: Star, label: "Loyalty & Membership", desc: "Tiers & birthday rewards", path: GUEST_ENTRY_PATH, color: "amber" },
  { icon: Sparkles, label: "AI Personalization", desc: "Smart menu & dietary AI", path: GUEST_ENTRY_PATH, color: "violet" },
  { icon: Sparkles, label: "Future AI Roadmap", desc: "Voice waiter, mood AI & more", path: GUEST_ENTRY_PATH, color: "violet" },
  { icon: CreditCard, label: "Payment & Billing", desc: "UPI, split pay, GST", path: GUEST_ENTRY_PATH, color: "emerald" },
  { icon: Headphones, label: "Live Support", desc: "Chat, voice & tickets", path: GUEST_ENTRY_PATH, color: "cyan" },
  { icon: Languages, label: "Language & A11y", desc: "Hindi, English & regional", path: GUEST_ENTRY_PATH, color: "indigo" },
  { icon: Wifi, label: "Offline Mode", desc: "Cached menu & sync", path: GUEST_ENTRY_PATH, color: "teal" },
  { icon: Smartphone, label: "PWA Experience", desc: "Install & push alerts", path: GUEST_ENTRY_PATH, color: "orange" },
  { icon: Monitor, label: "Smart Kiosk", desc: "Self order & NFC pay", path: GUEST_ENTRY_PATH, color: "violet" },
  { icon: Film, label: "Digital Experience", desc: "Offers, themes & video", path: GUEST_ENTRY_PATH, color: "rose" },
  { icon: Star, label: "Social & Reviews", desc: "Ratings, photos & share", path: GUEST_ENTRY_PATH, color: "amber" },
];

const navLinks = [
  { label: "Guest Experience", path: "#guest-web" },
  { label: "Features", path: "#features" },
  { label: "Pricing", path: "#pricing" },
];

const stats = [
  { value: "10,000+", label: "Restaurants" },
  { value: "50M+", label: "Menu Scans" },
  { value: "120+", label: "Countries" },
  { value: "99.9%", label: "Uptime" },
];

const venueTypes = [
  { icon: Utensils, label: "Restaurants" },
  { icon: Building2, label: "Hotels & Resorts" },
  { icon: Coffee, label: "Bars & Lounges" },
  { icon: MapPin, label: "Food Courts" },
  { icon: Waves, label: "Beach Clubs" },
  { icon: ChefHat, label: "Cloud Kitchens" },
];

const features = [
  { icon: QrCode, title: "QR & Digital Menus", desc: "Beautiful contactless menus that update in real time. No app required — just scan and explore." },
  { icon: CreditCard, title: "Integrated Payments", desc: "Accept every payment method with automated settlements and real-time tracking." },
  { icon: BarChart3, title: "Analytics & Insights", desc: "Live dashboards revealing what's selling, who's ordering, and when." },
  { icon: Users, title: "CRM & Loyalty", desc: "Reward regulars, run campaigns, and turn first-time guests into lifetime fans." },
  { icon: Utensils, title: "Kitchen Display", desc: "Route orders directly to the kitchen. Cut prep time and reduce errors." },
  { icon: Shield, title: "Enterprise Security", desc: "SOC 2 compliant with RBAC, audit trails, fraud detection, and KYC." },
];

const testimonials = [
  { quote: "FastMenu transformed our operations overnight. Revenue up 34% in the first month.", name: "Rahul Sharma", role: "Owner, The Grand Spice", initials: "RS" },
  { quote: "The QR menu is gorgeous. Our guests love it and staff spends less time on orders.", name: "Priya Mehta", role: "GM, Skyline Lounge", initials: "PM" },
  { quote: "Analytics alone paid for the subscription. We cut waste by 28% in two weeks.", name: "Arjun Patel", role: "F&B Director, Coastline Hotels", initials: "AP" },
];

const TRUST_POINTS = ["No app download", "Works offline", "GST compliant", "24/7 support"];

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Always open the admin login. `user` is the single source of truth: if a valid
  // super-admin session exists, the Login page itself forwards to /dashboard; if not,
  // it shows the login form. (Branching on the possibly-stale `isAuthenticated` flag
  // was sending the button to "/" / "/dashboard" and making it look like nothing opened.)
  function goAdmin() { navigate("/login"); }
  function goUserMenu() { navigate(DEMO_MENU_URL); }
  function goRestaurant() { navigate("/restaurant/login"); }
  function goRestaurantRegister() { navigate("/restaurant/register"); }
  function scrollTo(id: string) {
    document.getElementById(id.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  }

  return (
    <div className="guest-mesh min-h-screen text-white font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-50 guest-glass">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <GuestLogo size="sm" />
              <span className="font-display text-lg font-bold tracking-tight">FastMenu</span>
            </div>

            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map(link => (
                <button key={link.label} onClick={() => scrollTo(link.path)} className="px-3 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                  {link.label}
                </button>
              ))}
              <button onClick={goUserMenu} className="px-3 py-2 text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors rounded-lg hover:bg-orange-500/10">
                Try Guest Menu
              </button>
            </nav>

            <div className="hidden lg:flex items-center gap-2">
              <button onClick={goRestaurant} className="guest-btn-secondary px-4 py-2 text-sm">Restaurant</button>
              <button onClick={goAdmin} className="guest-btn-secondary px-4 py-2 text-sm">Admin</button>
              <button onClick={goUserMenu} className="guest-btn-primary px-5 py-2.5 text-sm">
                Open Guest Web <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <button className="lg:hidden p-2 text-white/70 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/5 py-4 space-y-1">
              {navLinks.map(link => (
                <button key={link.label} onClick={() => scrollTo(link.path)} className="flex w-full px-3 py-2.5 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5">
                  {link.label}
                </button>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <button onClick={goUserMenu} className="guest-btn-primary w-full py-2.5 text-sm">Open Guest Web</button>
                <button onClick={goRestaurant} className="guest-btn-secondary w-full py-2 text-sm">Restaurant Login</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-300">
                <Smartphone className="h-3.5 w-3.5" />
                Guest Web Panel — Scan, Order, Track & Pay
              </div>

              <h1 className="font-display mb-6 text-4xl font-extrabold tracking-tight leading-[1.1] sm:text-5xl lg:text-6xl">
                Smart Hospitality{" "}
                <span className="guest-gradient-text">For Your Guests</span>
              </h1>

              <p className="mb-8 text-lg text-white/55 leading-relaxed max-w-xl mx-auto lg:mx-0">
                QR menus, live tracking, reservations, room service, wallet & loyalty —
                a complete guest experience in the browser. No app download required.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-4">
                <button onClick={goUserMenu} className="guest-btn-primary px-8 py-3.5 text-base w-full sm:w-auto">
                  <QrCode className="h-5 w-5" />
                  Try Demo Menu
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <button onClick={goRestaurant} className="guest-btn-secondary px-8 py-3.5 text-base w-full sm:w-auto border-amber-500/40 text-amber-200 hover:bg-amber-500/10">
                  <ChefHat className="h-5 w-5 text-amber-400" />
                  Restaurant Staff Login
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 ml-1">12 roles</span>
                </button>
                <button onClick={goRestaurantRegister} className="guest-btn-secondary px-8 py-3.5 text-base w-full sm:w-auto">
                  <Building2 className="h-4 w-4" />
                  Register Restaurant
                </button>
              </div>

              <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-10">
                {TRUST_POINTS.map(point => (
                  <div key={point} className="flex items-center gap-1.5 text-xs text-white/50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    {point}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {stats.map(s => (
                  <div key={s.label} className="guest-card p-4 text-center lg:text-left">
                    <div className="font-display text-2xl font-extrabold">{s.value}</div>
                    <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Guest Web */}
      <section id="guest-web" className="py-24 px-4 sm:px-6 lg:px-8 border-y border-white/5">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="guest-section-label mb-4">User Web Panel</p>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything your guests need
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto mb-8">
              20+ connected modules — menu ordering, reservations, hotel services, wallet, and support.
            </p>
            <button onClick={goUserMenu} className="guest-btn-primary px-6 py-3 text-sm">
              <QrCode className="h-4 w-4" />
              Try Demo Menu
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {userWebFeatures.map(f => (
              <button
                key={f.label}
                onClick={() => navigate(f.path)}
                className="guest-card guest-card-interactive p-5 text-left group"
              >
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${FEATURE_COLORS[f.color] ?? FEATURE_COLORS.orange}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold text-white mb-1 group-hover:text-orange-300 transition-colors">{f.label}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-orange-400/0 group-hover:text-orange-400/80 transition-all">
                  Open <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 guest-card p-6">
            <h3 className="font-display font-semibold mb-1">Smart Entry & Access</h3>
            <p className="text-xs text-white/40 mb-4">QR, NFC, room, poolside, spa, event, parking & PWA</p>
            <div className="flex flex-wrap gap-2">
              {smartEntryDemos.map(d => (
                <button key={d.label} onClick={() => navigate(d.path)} className="guest-pill hover:text-orange-300">
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Venue types */}
      <div className="py-6 border-b border-white/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[10px] text-white/30 mb-4 uppercase tracking-[0.25em]">Trusted by venues worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {venueTypes.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operator features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="guest-section-label mb-4">For Operators</p>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Power tools behind the scenes
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Kitchen displays, analytics, CRM, and enterprise controls for your team.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="guest-card p-6 group">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <f.icon className="h-5 w-5 text-orange-400" />
                </div>
                <h3 className="font-display font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 guest-card p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-amber-500/20 bg-amber-500/5">
            <div>
              <h3 className="font-display text-xl font-bold text-amber-100 mb-2">Restaurant Manager Portal</h3>
              <p className="text-sm text-white/55 max-w-xl">
                Role-based staff login — Owner, Manager, Cashier, Waiter, Kitchen, Reception, Finance, HR, and more.
                New venues can register with KYC in minutes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button onClick={goRestaurant} className="guest-btn-primary px-6 py-3 text-sm bg-amber-500 hover:bg-amber-400 text-white">
                Staff Login
              </button>
              <button onClick={goRestaurantRegister} className="guest-btn-secondary px-6 py-3 text-sm">
                Register with KYC
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-y border-white/5">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl font-bold text-center mb-12">Loved by restaurant owners</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map(t => (
              <div key={t.name} className="guest-card p-6">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-sm text-white/70 leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-xs font-bold">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-white/40">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="guest-card p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight mb-4">
                Try the guest experience now
              </h2>
              <p className="text-white/55 mb-8 leading-relaxed">
                Open the demo menu — order, track, reserve, and explore every guest feature live.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={goUserMenu} className="guest-btn-primary px-8 py-3.5 text-sm">
                  Open Guest Web Demo <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={goAdmin} className="text-sm text-white/50 hover:text-white/80 transition-colors underline underline-offset-4">
                  Operator / Admin Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <GuestLogo size="sm" />
              <span className="font-display font-bold">FastMenu</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-white/30">
              <button onClick={goUserMenu} className="hover:text-orange-400 transition-colors font-medium">Guest Menu</button>
              <button onClick={goRestaurant} className="hover:text-white/60 transition-colors">Restaurant</button>
              <button onClick={goAdmin} className="hover:text-white/60 transition-colors">Admin</button>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-white/20">
            © 2026 FastMenu · Fastap Smart Hospitality OS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
