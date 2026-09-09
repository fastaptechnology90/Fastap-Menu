import { useLocation } from "wouter";
import {
  ArrowRight, ChevronRight, QrCode, BarChart3, Users,
  Shield, CreditCard, Utensils, MapPin, Building2,
  Coffee, Waves, ChefHat, Menu, X, Smartphone, Calendar, Clock,
  Headphones, Wallet, Hotel, Sparkles, Wine, Languages, Wifi, Monitor, Film,
  ShoppingBag, Receipt, LayoutDashboard,
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

const userWebFeatures = [
  { icon: QrCode, label: "Digital Menu", desc: "Browse, customize & order", path: GUEST_ENTRY_PATH },
  { icon: ShoppingBag, label: "Cart & Checkout", desc: "Order, split pay & schedule", path: GUEST_ENTRY_PATH },
  { icon: Receipt, label: "Smart Dining", desc: "Call waiter, live bill & split", path: GUEST_ENTRY_PATH },
  { icon: MapPin, label: "Smart Seating", desc: "Live tables & suggestions", path: GUEST_ENTRY_PATH },
  { icon: Calendar, label: "Reservations", desc: "Table, spa & event booking", path: GUEST_ENTRY_PATH },
  { icon: Sparkles, label: "Events & Banquet", desc: "Weddings & conferences", path: GUEST_ENTRY_PATH },
  { icon: Clock, label: "Waitlist", desc: "Join queue & get notified", path: GUEST_ENTRY_PATH },
  { icon: Smartphone, label: "Live Tracking", desc: "Real-time order status", path: GUEST_ENTRY_PATH },
  { icon: Hotel, label: "Room Service", desc: "Hotel guest requests", path: GUEST_ENTRY_PATH },
  { icon: Sparkles, label: "Spa & Wellness", desc: "Book treatments", path: GUEST_ENTRY_PATH },
  { icon: Wine, label: "Bar & Nightlife", desc: "Happy hour & cocktails", path: GUEST_ENTRY_PATH },
  { icon: Wallet, label: "Wallet & Loyalty", desc: "Recharge & transfer", path: GUEST_ENTRY_PATH },
  { icon: Sparkles, label: "Personalisation", desc: "Dietary filters & suggestions", path: GUEST_ENTRY_PATH },
  { icon: CreditCard, label: "Payment & Billing", desc: "UPI, split pay, GST", path: GUEST_ENTRY_PATH },
  { icon: Headphones, label: "Support", desc: "Raise and track a request", path: GUEST_ENTRY_PATH },
  { icon: Languages, label: "Language & A11y", desc: "Hindi, English & regional", path: GUEST_ENTRY_PATH },
  { icon: Wifi, label: "Offline Mode", desc: "Cached menu & sync", path: GUEST_ENTRY_PATH },
  { icon: Smartphone, label: "PWA Experience", desc: "Install & push alerts", path: GUEST_ENTRY_PATH },
  { icon: Monitor, label: "Smart Kiosk", desc: "Self order & NFC pay", path: GUEST_ENTRY_PATH },
  { icon: Film, label: "Digital Experience", desc: "Offers, themes & video", path: GUEST_ENTRY_PATH },
];

const navLinks = [
  { label: "Guest Experience", path: "#guest-web" },
  { label: "Features", path: "#features" },
  { label: "Get Started", path: "#get-started" },
];

// The three surfaces the product actually ships. This replaced a strip of vanity
// figures ("10,000+ Restaurants", "50M+ Menu Scans", "120+ Countries", "99.9% Uptime")
// that nothing in the product measures and no customer had produced.
const panels = [
  { icon: Smartphone, label: "Guest web", desc: "Scan to order, track and pay" },
  { icon: ChefHat, label: "Restaurant panel", desc: "Floor, kitchen, stock and reports" },
  { icon: LayoutDashboard, label: "Platform admin", desc: "Vendors, billing and settlements" },
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
  { icon: QrCode, title: "QR & Digital Menus", desc: "Contactless menus that update in real time. No app required — just scan and explore." },
  { icon: CreditCard, title: "Integrated Payments", desc: "Take UPI, card and cash at the table, with settlement and refund tracking behind it." },
  { icon: BarChart3, title: "Analytics & Insights", desc: "Live dashboards showing what is selling, who is ordering, and when." },
  { icon: Users, title: "CRM & Loyalty", desc: "Reward regulars, run campaigns, and turn first-time guests into repeat ones." },
  { icon: Utensils, title: "Kitchen Display", desc: "Route orders straight to the kitchen. Cut prep time and reduce errors." },
  // Was "SOC 2 compliant …". Nothing has been certified; naming a certification the
  // platform does not hold is a claim an enterprise buyer will check.
  { icon: Shield, title: "Access & Audit", desc: "Role-based access, full audit trails, fraud checks and vendor KYC." },
];

const TRUST_POINTS = ["No app download", "Works offline", "GST compliant", "Role-based staff access"];

export default function Landing() {
  const [, navigate] = useLocation();
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
    <div className="guest-page min-h-screen font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-50 guest-glass">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <GuestLogo size="sm" />
              <span className="font-display text-lg font-semibold tracking-tight">FastMenu</span>
            </div>

            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map(link => (
                <button key={link.label} onClick={() => scrollTo(link.path)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover-elevate">
                  {link.label}
                </button>
              ))}
              <button onClick={goUserMenu} className="px-3 py-2 text-sm text-primary font-medium transition-colors rounded-md hover-elevate">
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

            <button
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden border-t py-4 space-y-1">
              {navLinks.map(link => (
                <button key={link.label} onClick={() => scrollTo(link.path)} className="flex w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover-elevate">
                  {link.label}
                </button>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <button onClick={goUserMenu} className="guest-btn-primary w-full py-2.5 text-sm">Open Guest Web</button>
                <button onClick={goRestaurant} className="guest-btn-secondary w-full py-2 text-sm">Restaurant Login</button>
                <button onClick={goAdmin} className="guest-btn-secondary w-full py-2 text-sm">Admin Login</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="text-center lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                Guest web — scan, order, track & pay
              </div>

              <h1 className="font-display mb-6 text-3xl font-semibold tracking-tight leading-tight sm:text-4xl lg:text-5xl">
                Smart hospitality for your guests
              </h1>

              <p className="mb-8 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
                QR menus, live tracking, reservations, room service, wallet and loyalty —
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
                <button onClick={goRestaurant} className="guest-btn-secondary px-8 py-3.5 text-base w-full sm:w-auto">
                  <ChefHat className="h-5 w-5" />
                  Restaurant Staff Login
                </button>
                <button onClick={goRestaurantRegister} className="guest-btn-secondary px-8 py-3.5 text-base w-full sm:w-auto">
                  <Building2 className="h-4 w-4" />
                  Register Restaurant
                </button>
              </div>

              <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-10">
                {TRUST_POINTS.map(point => (
                  <div key={point} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    {point}
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {panels.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="guest-card p-4 text-left">
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="font-display text-sm font-semibold mt-2">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
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
      <section id="guest-web" className="py-24 px-4 sm:px-6 lg:px-8 border-y">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="guest-section-label mb-4">Guest web panel</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl mb-4">
              Everything your guests need
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              Menu ordering, reservations, hotel services, wallet and support — connected in one browser session.
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
                {/* One accent for the whole grid. This was a twelve-hue lookup table
                    that gave each tile an unrelated colour with no meaning behind it. */}
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md border bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold mb-1">{f.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 guest-card p-6">
            <h3 className="font-display font-semibold mb-1">Smart entry & access</h3>
            <p className="text-xs text-muted-foreground mb-4">QR, NFC, room, poolside, spa, event, parking and PWA</p>
            <div className="flex flex-wrap gap-2">
              {smartEntryDemos.map(d => (
                <button key={d.label} onClick={() => navigate(d.path)} className="guest-pill">
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Venue types */}
      <div className="py-6 border-b">
        {/* Was "Trusted by venues worldwide" over a list of venue *categories* — no
            venue named here is a customer. It says what the product is built for. */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-2xs text-muted-foreground mb-4 uppercase tracking-[0.25em]">Built for</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {venueTypes.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
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
            <p className="guest-section-label mb-4">For operators</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl mb-4">
              The tools behind the counter
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Kitchen displays, analytics, CRM and platform controls for your team.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="guest-card p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-md border bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 guest-card p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="font-display text-lg font-semibold mb-2">Restaurant manager portal</h3>
              <p className="text-sm text-muted-foreground max-w-xl">
                Role-based staff login — owner, manager, cashier, waiter, kitchen, bar, reception,
                housekeeping, spa, finance, HR and franchise. New venues register with KYC.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button onClick={goRestaurant} className="guest-btn-primary px-6 py-3 text-sm">
                Staff Login
              </button>
              <button onClick={goRestaurantRegister} className="guest-btn-secondary px-6 py-3 text-sm">
                Register with KYC
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — was a "Loved by restaurant owners" wall of three invented people, one of
          whom credited the product with a 34% revenue rise. None of it was a customer. */}
      <section id="get-started" className="py-20 px-4 sm:px-6 lg:px-8 border-t">
        <div className="mx-auto max-w-3xl">
          <div className="guest-card p-8 sm:p-12 text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
              Try the guest experience now
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Open the demo menu — order, track, reserve and explore every guest feature live.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={goUserMenu} className="guest-btn-primary px-8 py-3.5 text-sm w-full sm:w-auto">
                Open Guest Web Demo <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={goAdmin} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
                Operator / Admin sign in
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <GuestLogo size="sm" />
              <span className="font-display font-semibold">FastMenu</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
              <button onClick={goUserMenu} className="hover:text-foreground transition-colors font-medium">Guest Menu</button>
              <button onClick={goRestaurant} className="hover:text-foreground transition-colors">Restaurant</button>
              <button onClick={goAdmin} className="hover:text-foreground transition-colors">Admin</button>
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} FastMenu · Fastap Smart Hospitality OS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
