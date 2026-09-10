import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, ChevronRight, QrCode, BarChart3, Users,
  Shield, CreditCard, Utensils, MapPin, Building2,
  Coffee, Waves, ChefHat, Menu, X, Smartphone, Calendar, Clock,
  Headphones, Wallet, Hotel, Sparkles, Wine, Languages, Wifi, Monitor, Film,
  ShoppingBag, Receipt, LayoutDashboard,
  CheckCircle2,
} from "lucide-react";
import { SiteBrand } from "@/components/site/SiteBrand";
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
  { icon: Film, label: "Digital Experience", desc: "Offers (prize games preview-only)", path: "/user/experience" },
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
    <div className="fastap-site">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <button onClick={() => navigate("/")} className="flex shrink-0 items-center" aria-label="FastMenu home">
              <SiteBrand />
            </button>

            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map(link => (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.path)}
                  className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </button>
              ))}
              <button onClick={goUserMenu} className="text-sm font-semibold text-primary transition-colors hover:text-primary/80">
                Try Guest Menu
              </button>
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={goRestaurant}
                className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Restaurant
              </button>
              <button
                onClick={goAdmin}
                className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Admin
              </button>
              <button onClick={goUserMenu} className="fs-pill-red">
                Open Guest Web <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </button>
            </div>

            <button
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-border py-4">
              <nav className="flex flex-col gap-1">
                {navLinks.map(link => (
                  <button
                    key={link.label}
                    onClick={() => scrollTo(link.path)}
                    className="rounded-lg px-2 py-2.5 text-left text-base font-semibold text-foreground hover:bg-muted"
                  >
                    {link.label}
                  </button>
                ))}
              </nav>
              <div className="pt-3 flex flex-col gap-2.5">
                <button onClick={goUserMenu} className="fs-cta w-full">Open Guest Web</button>
                <button onClick={goRestaurant} className="fs-cta-ghost w-full border-border text-foreground">Restaurant Login</button>
                <button onClick={goAdmin} className="fs-cta-ghost w-full border-border text-foreground">Admin Login</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero. Warm light ground with a soft wash behind the phone rather than a dark
          photographic scrim — this is a hospitality product, and the first screen should
          feel like a room with the lights on. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60rem 40rem at 78% 18%, hsl(20 60% 93% / 0.85), transparent 60%),"
              + "radial-gradient(50rem 34rem at 8% 90%, hsl(356 60% 95% / 0.7), transparent 60%)",
          }}
        />

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="text-center lg:col-span-7 lg:text-left">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-semibold text-muted-foreground sm:text-[0.8125rem]">
                <Smartphone className="h-3.5 w-3.5 text-primary" />
                Guest web — scan, order, track &amp; pay
              </p>

              <h1 className="fs-display-xl text-[2.35rem] text-foreground sm:text-5xl lg:text-[3.5rem]">
                Smart hospitality
                <br className="hidden sm:block" />{" "}
                <span className="text-primary">for your guests</span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                QR menus, live tracking, reservations, room service, wallet and loyalty —
                a complete guest experience in the browser. No app download required.
              </p>

              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
                <button onClick={goUserMenu} className="fs-cta">
                  <QrCode className="h-5 w-5" />
                  Try Demo Menu
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={goRestaurant} className="fs-cta-ghost border-border text-foreground hover:bg-muted">
                  <ChefHat className="h-5 w-5" />
                  Restaurant Staff Login
                </button>
              </div>

              <div className="mt-4 flex justify-center lg:justify-start">
                <button
                  onClick={goRestaurantRegister}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4"
                >
                  <Building2 className="h-4 w-4" />
                  Register Restaurant
                </button>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2.5 lg:justify-start">
                {TRUST_POINTS.map(point => (
                  <div key={point} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {point}
                  </div>
                ))}
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {panels.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="fs-tile p-4 text-left">
                    <Icon className="h-5 w-5 text-primary" />
                    <div className="fs-display mt-2.5 text-sm text-foreground">{label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center lg:col-span-5 lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Guest Web */}
      <section id="guest-web" className="scroll-mt-20 border-y border-border bg-muted">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="fs-eyebrow">Guest web panel</p>
            <h2 className="fs-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-[2.75rem]">
              Everything your guests need
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Menu ordering, reservations, hotel services, wallet and support — connected in one browser session.
            </p>
            <button onClick={goUserMenu} className="fs-cta mt-8">
              <QrCode className="h-4 w-4" />
              Try Demo Menu
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {userWebFeatures.map(f => (
              <button
                key={f.label}
                onClick={() => navigate(f.path)}
                className="fs-tile group p-5 text-left transition-shadow hover:shadow-md"
              >
                {/* One accent for the whole grid. This was a twelve-hue lookup table
                    that gave each tile an unrelated colour with no meaning behind it. */}
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="fs-display text-[0.9375rem] text-foreground">{f.label}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>

          <div className="fs-tile mt-8 p-6">
            <h3 className="fs-display text-lg text-foreground">Smart entry &amp; access</h3>
            <p className="mt-1 text-xs text-muted-foreground">QR, NFC, room, poolside, spa, event, parking and PWA</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {smartEntryDemos.map(d => (
                <button
                  key={d.label}
                  onClick={() => navigate(d.path)}
                  className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Venue types */}
      <div className="border-b border-border bg-background py-8">
        {/* Was "Trusted by venues worldwide" over a list of venue *categories* — no
            venue named here is a customer. It says what the product is built for. */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
            <p className="fs-eyebrow shrink-0">Built for</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {venueTypes.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary/70" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Operator features */}
      <section id="features" className="scroll-mt-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="fs-eyebrow">For operators</p>
            <h2 className="fs-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-[2.75rem]">
              The tools behind the counter
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Kitchen displays, analytics, CRM and platform controls for your team.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(f => (
              <div key={f.title}>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="fs-display text-lg text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="fs-tile mt-12 flex flex-col gap-6 p-7 sm:p-9 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="fs-display text-xl text-foreground">Restaurant manager portal</h3>
              <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
                Role-based staff login — owner, manager, cashier, waiter, kitchen, bar, reception,
                housekeeping, spa, finance, HR and franchise. New venues register with KYC.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <button onClick={goRestaurant} className="fs-cta">Staff Login</button>
              <button onClick={goRestaurantRegister} className="fs-cta-ghost border-border text-foreground hover:bg-muted">
                Register with KYC
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — was a "Loved by restaurant owners" wall of three invented people, one of
          whom credited the product with a 34% revenue rise. None of it was a customer. */}
      <section id="get-started" className="scroll-mt-20 border-t border-border bg-muted">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <h2 className="fs-display text-3xl text-foreground sm:text-4xl lg:text-[2.75rem]">
            Try the guest experience now
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Open the demo menu — order, track, reserve and explore every guest feature live.
          </p>
          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <button onClick={goUserMenu} className="fs-cta">
              Open Guest Web Demo <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={goAdmin}
              className="inline-flex min-h-12 items-center justify-center px-4 text-sm font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Operator / Admin sign in
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <SiteBrand />
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm text-muted-foreground">
              <button onClick={goUserMenu} className="font-semibold transition-colors hover:text-foreground">Guest Menu</button>
              <button onClick={goRestaurant} className="transition-colors hover:text-foreground">Restaurant</button>
              <button onClick={goAdmin} className="transition-colors hover:text-foreground">Admin</button>
            </div>
          </div>
          <p className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} FastMenu · Fastap Smart Hospitality OS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
