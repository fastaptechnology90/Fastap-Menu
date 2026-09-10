import { useLocation } from "wouter";
import {
  ArrowRight, ChevronRight, QrCode, BarChart3, Users,
  Shield, CreditCard, Utensils, MapPin, Building2,
  Coffee, Waves, ChefHat, Menu, X, Smartphone, Calendar, Clock,
  Headphones, Wallet, Hotel, Sparkles, Wine, Languages, Wifi, Monitor, Film,
  ShoppingBag, Receipt, LayoutDashboard,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

type GuestGroup = {
  heading: string;
  note: string;
  items: { icon: LucideIcon; label: string; desc: string; path: string }[];
};

// Grouped rather than left as one undifferentiated wall of twenty tiles. Somebody
// reading this is looking for one of three things — a table, a room, or the bill —
// and the headings say which pile each feature is in.
const guestGroups: GuestGroup[] = [
  {
    heading: "At the table",
    note: "Scan the code on the table and the rest follows",
    items: [
      { icon: QrCode, label: "Digital menu", desc: "Browse, customise and order", path: GUEST_ENTRY_PATH },
      { icon: ShoppingBag, label: "Cart & checkout", desc: "Order, split the bill, schedule ahead", path: GUEST_ENTRY_PATH },
      { icon: Receipt, label: "Live bill", desc: "Call a waiter, watch the total build", path: GUEST_ENTRY_PATH },
      { icon: Smartphone, label: "Order tracking", desc: "Accepted, cooking, on its way", path: GUEST_ENTRY_PATH },
      { icon: CreditCard, label: "Payment", desc: "UPI, cards, split pay, GST invoice", path: GUEST_ENTRY_PATH },
      { icon: Monitor, label: "Self-order kiosk", desc: "Order and tap to pay at the counter", path: GUEST_ENTRY_PATH },
    ],
  },
  {
    heading: "Before they arrive",
    note: "Seating, bookings and the queue",
    items: [
      { icon: Calendar, label: "Reservations", desc: "Tables, spa slots and event dates", path: GUEST_ENTRY_PATH },
      { icon: MapPin, label: "Smart seating", desc: "Live floor and table suggestions", path: GUEST_ENTRY_PATH },
      { icon: Clock, label: "Waitlist", desc: "Join the queue, get a message back", path: GUEST_ENTRY_PATH },
      { icon: Sparkles, label: "Events & banquets", desc: "Weddings, conferences, private halls", path: GUEST_ENTRY_PATH },
      { icon: Hotel, label: "Room service", desc: "In-room ordering for hotel guests", path: GUEST_ENTRY_PATH },
      { icon: Waves, label: "Spa & wellness", desc: "Book treatments and therapists", path: GUEST_ENTRY_PATH },
    ],
  },
  {
    heading: "Everything else",
    note: "The parts guests notice only when they are missing",
    items: [
      { icon: Wallet, label: "Wallet & loyalty", desc: "Recharge, transfer, earn points", path: GUEST_ENTRY_PATH },
      { icon: Wine, label: "Bar & nightlife", desc: "Happy hour, cocktails, table service", path: GUEST_ENTRY_PATH },
      { icon: Sparkles, label: "Dietary filters", desc: "Jain, vegan, allergen and spice level", path: GUEST_ENTRY_PATH },
      { icon: Languages, label: "Languages", desc: "Hindi, English and regional", path: GUEST_ENTRY_PATH },
      { icon: Wifi, label: "Works offline", desc: "Cached menu, syncs when signal returns", path: GUEST_ENTRY_PATH },
      { icon: Headphones, label: "Support", desc: "Raise a request and track it", path: GUEST_ENTRY_PATH },
      { icon: Smartphone, label: "Install as an app", desc: "Add to home screen, push alerts", path: GUEST_ENTRY_PATH },
      { icon: Film, label: "Offers & experiences", desc: "Campaigns and seasonal offers", path: "/user/experience" },
    ],
  },
];

const navLinks = [
  { label: "For guests", path: "#guest-web" },
  { label: "For your team", path: "#features" },
  { label: "Get started", path: "#get-started" },
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
  { icon: Building2, label: "Hotels & resorts" },
  { icon: Coffee, label: "Bars & lounges" },
  { icon: MapPin, label: "Food courts" },
  { icon: Waves, label: "Beach clubs" },
  { icon: ChefHat, label: "Cloud kitchens" },
];

const features = [
  { icon: QrCode, title: "QR & digital menus", desc: "Change a price at four in the afternoon and the next guest to scan sees it. Nothing to download, nothing to reprint." },
  { icon: CreditCard, title: "Payments that reconcile", desc: "UPI, card and cash taken at the table, with settlement and refunds tracked against the same order." },
  { icon: BarChart3, title: "Numbers you can act on", desc: "What sold, what sat, which hours carried the day — and the same totals in the report as on the bill." },
  { icon: Users, title: "CRM & loyalty", desc: "Remember the regulars, run a campaign at them, and see whether it actually brought anybody back." },
  { icon: Utensils, title: "Kitchen display", desc: "Orders go straight to the pass. No shouting, no paper ticket going missing under a hot plate." },
  // Was "SOC 2 compliant …". Nothing has been certified; naming a certification the
  // platform does not hold is a claim an enterprise buyer will check.
  { icon: Shield, title: "Access & audit", desc: "Every role sees only its own screens, and every change leaves a trail with a name against it." },
];

const TRUST_POINTS = ["No app to download", "Works offline", "GST compliant", "Role-based staff access"];

// The flow, in the order it happens. The first question a venue owner asks is
// "what does this actually do on a Friday night", and a grid of features has
// never once answered it.
const flow = [
  { step: "01", title: "Guest scans", body: "The code on the table opens the menu in the browser. No app, no wifi password, no waiting to catch someone's eye." },
  { step: "02", title: "Kitchen sees it", body: "The order lands on the kitchen display the moment it is placed, with the table number and the notes attached to it." },
  { step: "03", title: "Waiter runs it", body: "Prep, ready and served are one tap each. The guest watches the same status move along on their own phone." },
  { step: "04", title: "Bill settles", body: "Split it, add GST, take UPI or cash. The payment is written against the order, so the day closes clean." },
];

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
    <div className="landing-page font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2.5">
              <GuestLogo size="sm" />
              <span className="landing-serif text-lg">FastMenu</span>
            </div>

            <nav className="hidden lg:flex items-center gap-7">
              {navLinks.map(link => (
                <button key={link.label} onClick={() => scrollTo(link.path)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-5">
              <button onClick={goRestaurant} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Staff sign in</button>
              <button onClick={goUserMenu} className="guest-btn-primary px-5 py-2.5 text-sm">
                See the guest menu <ArrowRight className="h-3.5 w-3.5" />
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
                <button key={link.label} onClick={() => scrollTo(link.path)} className="flex w-full px-1 py-2.5 text-sm text-muted-foreground hover:text-foreground">
                  {link.label}
                </button>
              ))}
              <div className="pt-3 flex flex-col gap-2">
                <button onClick={goUserMenu} className="guest-btn-primary w-full py-2.5 text-sm">See the guest menu</button>
                <button onClick={goRestaurant} className="guest-btn-secondary w-full py-2 text-sm">Restaurant sign in</button>
                <button onClick={goAdmin} className="guest-btn-secondary w-full py-2 text-sm">Admin sign in</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero — asymmetric on purpose. A centred headline over a centred sub over a
          centred pair of buttons is the shape of every template on the internet. */}
      <section className="px-5 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            <div className="lg:col-span-7">
              <p className="landing-eyebrow mb-6">Smart hospitality</p>

              <h1 className="landing-serif text-[2.1rem] leading-[1.12] sm:text-5xl lg:text-[3.4rem] mb-6">
                Your dining room,{" "}
                <span className="text-primary italic">running on its own.</span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-8">
                A guest scans the code on the table and orders. The kitchen sees it,
                the waiter runs it, the bill settles itself. You get the evening back.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <button onClick={goUserMenu} className="guest-btn-primary px-7 py-3.5 text-base">
                  <QrCode className="h-5 w-5" />
                  Try the demo menu
                </button>
                <button onClick={goRestaurantRegister} className="guest-btn-secondary px-7 py-3.5 text-base">
                  <Building2 className="h-4 w-4" />
                  Register your venue
                </button>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                {TRUST_POINTS.map(point => (
                  <div key={point} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Venue types — a plain line of text, not a fake logo wall. */}
      <div className="landing-band py-7 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Was "Trusted by venues worldwide" over a list of venue *categories* — no
              venue named here is a customer. It says what the product is built for. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <p className="landing-serif text-sm italic text-muted-foreground shrink-0">Built for</p>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
              {venueTypes.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary/70" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <section className="py-20 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl mb-12">
            <p className="landing-eyebrow mb-5">One evening, start to finish</p>
            <h2 className="landing-serif text-3xl sm:text-4xl leading-tight">
              Four steps, and nobody has to shout across the pass
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
            {flow.map(s => (
              <div key={s.step}>
                <div className="landing-serif text-3xl text-primary/40 mb-3">{s.step}</div>
                <div className="landing-rule mb-4" />
                <h3 className="landing-serif text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guest web */}
      <section id="guest-web" className="landing-band py-20 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div className="max-w-xl">
              <p className="landing-eyebrow mb-5">For guests</p>
              <h2 className="landing-serif text-3xl sm:text-4xl leading-tight mb-4">
                Everything a guest can do from their own phone
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                One browser session covers the table, the room, the spa and the bill.
                Open any of these to see the real screen.
              </p>
            </div>
            <button onClick={goUserMenu} className="guest-btn-primary px-6 py-3 text-sm shrink-0">
              <QrCode className="h-4 w-4" />
              Open the demo
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-x-10 gap-y-10">
            {guestGroups.map(group => (
              <div key={group.heading}>
                <h3 className="landing-serif text-xl mb-1">{group.heading}</h3>
                <p className="text-xs text-muted-foreground mb-4">{group.note}</p>
                <div className="border-t">
                  {group.items.map(item => (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="landing-row group"
                    >
                      <span className="landing-row__icon">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="block text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 mt-1 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 rounded-lg border bg-card p-6">
            <div className="shrink-0">
              <h3 className="landing-serif text-lg">However they arrive</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Table, room, poolside, spa, event, parking</p>
            </div>
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

      {/* Operator features */}
      <section id="features" className="py-20 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl mb-12">
            <p className="landing-eyebrow mb-5">For your team</p>
            <h2 className="landing-serif text-3xl sm:text-4xl leading-tight mb-4">
              The half of it the guest never sees
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Kitchen displays, stock, staff rosters, reports and platform controls —
              the same data the guest's phone is reading, from the other side of it.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-9">
            {features.map(f => (
              <div key={f.title}>
                <div className="landing-row__icon mb-4 h-10 w-10">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="landing-serif text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid sm:grid-cols-3 gap-5">
            {panels.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border bg-card p-5">
                <Icon className="h-4 w-4 text-primary" />
                <div className="landing-serif text-base mt-3">{label}</div>
                <div className="text-xs text-muted-foreground mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — was a "Loved by restaurant owners" wall of three invented people, one of
          whom credited the product with a 34% revenue rise. None of it was a customer. */}
      <section id="get-started" className="landing-band py-20 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <h2 className="landing-serif text-3xl sm:text-4xl leading-tight mb-4">
                Have a look before you decide anything
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-7">
                The demo menu is the real guest web, running on a real restaurant's data.
                Browse it, open a dish, walk through the checkout — none of it is a screenshot.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={goUserMenu} className="guest-btn-primary px-7 py-3.5 text-sm">
                  Open the demo menu <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={goRestaurantRegister} className="guest-btn-secondary px-7 py-3.5 text-sm">
                  Register your venue
                </button>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-7">
              <h3 className="landing-serif text-lg mb-1">Already set up?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Staff sign in with the role their manager gave them — owner, manager,
                cashier, waiter, kitchen, bar, reception, housekeeping, spa, finance, HR.
              </p>
              <div className="flex flex-col gap-3 items-start">
                <button onClick={goRestaurant} className="guest-btn-secondary w-full py-3 text-sm">
                  <ChefHat className="h-4 w-4" />
                  Restaurant staff sign in
                </button>
                <button onClick={goAdmin} className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
                  Platform admin sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <GuestLogo size="sm" />
              <span className="landing-serif">FastMenu</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
              <button onClick={goUserMenu} className="hover:text-foreground transition-colors font-medium">Guest menu</button>
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
