/**
 * The public landing page.
 *
 * Built to read like a consumer food brand rather than restaurant software: a
 * full-bleed photographic hero under a dark scrim, headlines set enormous in a
 * geometric round sans, one saturated red doing all the pointing, big
 * soft-cornered tiles, and copy in short declarative lines instead of paragraphs.
 *
 * Everything sits inside `.fastap-site` (see index.css), which is its own light
 * scope. The guest web, restaurant panel and admin panel keep the dark product
 * theme they had — nothing here leaks into them.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, BarChart3, ChefHat, ClipboardList, FileText, Gift,
  Menu as MenuIcon, QrCode, ReceiptIndianRupee, ShieldCheck, Smartphone,
  Store, Users, Wallet, WifiOff, X, Check, Clock, CreditCard,
} from "lucide-react";
import { SiteBrand } from "@/components/site/SiteBrand";
import { DEMO_MENU_URL } from "@/lib/guestDemo";

const NAV = [
  ["What you get", "#pillars"],
  ["How it works", "#how"],
  ["Features", "#features"],
  ["What it costs", "#pricing"],
] as const;

/** The three things a restaurant actually does in a day, as the big tiles. */
const PILLARS = [
  {
    icon: QrCode,
    title: "Order at the table",
    body: "The guest scans the code taped to the table, reads your menu with photos, and sends the order straight to the kitchen. No app to install, no waiting to catch someone's eye.",
    tint: "#fff1e6",
    ink: "#8a4a12",
  },
  {
    icon: ReceiptIndianRupee,
    title: "Bill at the counter",
    body: "Split it, merge it, park it, discount it, refund it. A GST invoice with the right place of supply prints in under a second, on the printer you already own.",
    tint: "#fdeced",
    ink: "#96222c",
  },
  {
    icon: BarChart3,
    title: "Books that tally",
    body: "Sales, expenses, wallet and the day's cash drawer, closed out at the end of every shift. Export it and hand it to your accountant.",
    tint: "#e9f2ee",
    ink: "#1e5145",
  },
];

const HOW = [
  { n: "01", title: "Sign up", body: "Name, mobile, restaurant. No KYC to get started — upload documents later, or let our team collect them." },
  { n: "02", title: "Put your menu in", body: "Categories, dishes, prices, photos. Import a list or type it once — it is the same menu the QR code shows." },
  { n: "03", title: "Print the codes", body: "One code per table, generated for you. Tape them down and the floor is live." },
  { n: "04", title: "Start serving", body: "Orders land on the kitchen display, bills settle at the counter, and the day closes itself out." },
];

const FEATURES = [
  { icon: ChefHat, title: "Kitchen display", body: "Tickets appear, get bumped, get recalled. No printer roll, no shouting across the pass." },
  { icon: Store, title: "Tables and zones", body: "Move, merge and split tables. See the whole floor at a glance from anywhere." },
  { icon: FileText, title: "GST done right", body: "CGST/SGST or IGST picked from the place of supply. Invoice series, HSN, the lot." },
  { icon: Gift, title: "Offers and loyalty", body: "Points, coupons, happy hours and campaigns that bring the regulars back." },
  { icon: Wallet, title: "Wallet and payments", body: "UPI, card and cash at the table, with settlement and refunds tracked against the order." },
  { icon: Users, title: "Staff and roles", body: "Every action carries a name. Owner, manager, cashier, waiter, kitchen — each sees only their own screen." },
  { icon: ClipboardList, title: "Stock and expenses", body: "Recurring bills, categories, and stock drawn down on a sale. What went out, not just what came in." },
  { icon: WifiOff, title: "Works when the line drops", body: "The counter keeps billing when the uplink dies and syncs when it comes back." },
  { icon: ShieldCheck, title: "Your data stays yours", body: "Every restaurant is isolated from every other. Export everything, any day, no ransom." },
];

const NUMBERS = [
  { value: "3", label: "apps for your staff" },
  { value: "12", label: "staff roles" },
  { value: "0", label: "apps for your guests" },
  { value: "1 day", label: "to get approved" },
];

const INCLUDED = [
  "QR ordering on every table",
  "Counter billing and GST invoices",
  "Kitchen display",
  "Waiter and housekeeping apps",
  "Tables, zones and floor map",
  "Menu with photos and variants",
  "Offers, coupons and loyalty",
  "Reservations and waitlist",
  "Stock and expenses",
  "Staff roles and attendance",
  "Reports and day-end close",
  "Room service, if you run rooms",
];

export default function Landing() {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function go(path: string) { navigate(path); setMenuOpen(false); }
  function jump(hash: string) {
    document.getElementById(hash.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  return (
    <div className="fastap-site">
      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={() => go("/")} className="flex shrink-0 items-center" aria-label="Fastap OS home">
            <SiteBrand />
          </button>

          <nav className="ml-8 hidden items-center gap-7 lg:flex" aria-label="Sections">
            {NAV.map(([label, href]) => (
              <button
                key={href}
                onClick={() => jump(href)}
                className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <button
              onClick={() => go("/restaurant/login")}
              className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Log in
            </button>
            <button onClick={() => go("/restaurant/register")} className="fs-pill-red">
              Sign up
            </button>
          </div>

          <button
            className="ml-auto p-2 text-muted-foreground sm:ml-3 lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Sections">
              {NAV.map(([label, href]) => (
                <button
                  key={href}
                  onClick={() => jump(href)}
                  className="rounded-lg px-2 py-2.5 text-left text-base font-semibold text-foreground hover:bg-muted"
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2.5 sm:hidden">
              <button onClick={() => go("/restaurant/register")} className="fs-cta w-full">Sign up</button>
              <button
                onClick={() => go("/restaurant/login")}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-border text-base font-semibold text-foreground"
              >
                Log in
              </button>
            </div>
          </div>
        )}
      </header>

      {/* -------------------------------------------------------------- hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src="/img/cafe-counter.webp"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(12,10,10,0.86) 0%, rgba(12,10,10,0.72) 45%, rgba(12,10,10,0.88) 100%)",
          }}
        />

        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-32 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/85 ring-1 ring-inset ring-white/20 sm:text-[0.8125rem]">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              No KYC. No paperwork.
            </p>

            <h1 className="fs-display-xl text-[2.5rem] text-white sm:text-6xl lg:text-7xl">
              Run your whole restaurant
              <br className="hidden sm:block" />{" "}
              <span style={{ color: "#ff8a8f" }}>from one screen.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:mt-6 sm:text-xl">
              QR ordering at the table, billing at the counter, a kitchen display, GST
              invoices that are actually correct, and loyalty that brings people back.
            </p>

            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center">
              <button onClick={() => go("/restaurant/register")} className="fs-cta">
                Start free
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <button onClick={() => jump("#how")} className="fs-cta-ghost text-white/90 hover:bg-white/10">
                See how it works
              </button>
            </div>

            <p className="mt-5 text-sm text-white/65">
              Free to start. No card. Approved in a day.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- numbers */}
      <section aria-label="At a glance" className="bg-primary">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8 lg:py-12">
          {NUMBERS.map(n => (
            <div key={n.label} className="text-center">
              <div className="fs-display-xl text-3xl text-white sm:text-4xl lg:text-5xl">{n.value}</div>
              <div className="mt-1 text-sm font-medium text-white/80 sm:text-base">{n.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- pillars */}
      <section id="pillars" className="scroll-mt-20 bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="fs-eyebrow">What you get</p>
            <h2 className="fs-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">
              Three things, done properly
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Not forty half-finished modules. The floor, the counter and the books.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:mt-14 lg:grid-cols-3">
            {PILLARS.map(p => (
              <article key={p.title} className="fs-tile p-7 sm:p-8">
                <span
                  className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: p.tint, color: p.ink }}
                >
                  <p.icon className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="fs-display mt-5 text-xl text-foreground sm:text-2xl">{p.title}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- how */}
      <section id="how" className="scroll-mt-20 bg-muted">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="fs-eyebrow">How it works</p>
              <h2 className="fs-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">
                Open by the weekend
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Four steps. Nobody has to be trained and nothing has to be installed on
                a guest's phone.
              </p>

              <ol className="mt-9 space-y-7">
                {HOW.map(s => (
                  <li key={s.n} className="flex gap-4">
                    <span className="fs-display shrink-0 text-lg text-primary">{s.n}</span>
                    <div>
                      <h3 className="fs-display text-lg text-foreground">{s.title}</h3>
                      <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => go("/restaurant/register")} className="fs-cta">
                  Start free <ArrowRight className="h-5 w-5" />
                </button>
                <button
                  onClick={() => go(DEMO_MENU_URL)}
                  className="fs-cta-ghost border-border text-foreground hover:bg-background"
                >
                  <QrCode className="h-5 w-5" />
                  See a guest menu
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl shadow-xl">
              <img
                src="/img/table-scan.webp"
                alt="A guest scanning the code on their table"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section id="features" className="scroll-mt-20 bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="fs-eyebrow">Features</p>
            <h2 className="fs-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">
              The half your guests never see
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Every one of these is a thing the product actually does today.
            </p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-10 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <div key={f.title}>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="fs-display mt-4 text-lg text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- pricing */}
      <section id="pricing" className="scroll-mt-20 bg-muted">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="fs-eyebrow">What it costs</p>
            <h2 className="fs-display mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">
              Everything is switched on from day one
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              No feature is held back for a higher tier. Talk to us about the rate for
              your venue — it depends on your size, not on which buttons you want.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-4xl">
            <div className="fs-tile p-7 sm:p-10">
              <h3 className="fs-display text-xl text-foreground sm:text-2xl">What is included</h3>
              <ul className="mt-6 grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                {INCLUDED.map(item => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-[0.9375rem] text-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-3 border-t border-border pt-7 sm:flex-row sm:items-center">
                <button onClick={() => go("/restaurant/register")} className="fs-cta">
                  Register your venue <ArrowRight className="h-5 w-5" />
                </button>
                <p className="text-sm text-muted-foreground sm:ml-2">
                  Approved in a day. No card to sign up.
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
            {[
              { icon: Clock, title: "Approved in a day", body: "Register in the evening, serve on it the next." },
              { icon: CreditCard, title: "No card to start", body: "Nothing is charged while you set the menu up." },
              { icon: ShieldCheck, title: "Leave whenever", body: "Export your menu, orders and guests on the way out." },
            ].map(x => (
              <div key={x.title} className="flex gap-3">
                <x.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="fs-display text-[0.9375rem] text-foreground">{x.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{x.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- cta */}
      <section className="relative isolate overflow-hidden bg-[#141010]">
        <img
          src="/img/cafe-counter.webp"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-40"
          loading="lazy"
        />
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
          <h2 className="fs-display-xl text-3xl text-white sm:text-5xl">
            Your tables are waiting.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/80 sm:text-lg">
            Set the menu up tonight, print the codes tomorrow, and let the floor run
            itself by the weekend.
          </p>
          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <button onClick={() => go("/restaurant/register")} className="fs-cta">
              Start free <ArrowRight className="h-5 w-5" />
            </button>
            <button onClick={() => go("/restaurant/login")} className="fs-cta-ghost text-white/90 hover:bg-white/10">
              I already have an account
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <SiteBrand />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                The operating system for a restaurant: orders, kitchen, billing and
                books, in one place.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-2">
              <div>
                <p className="fs-display text-sm text-foreground">Product</p>
                <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                  {NAV.map(([label, href]) => (
                    <li key={href}>
                      <button onClick={() => jump(href)} className="transition-colors hover:text-foreground">
                        {label}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button onClick={() => go(DEMO_MENU_URL)} className="transition-colors hover:text-foreground">
                      Guest menu demo
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <p className="fs-display text-sm text-foreground">Sign in</p>
                <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                  <li>
                    <button onClick={() => go("/restaurant/login")} className="transition-colors hover:text-foreground">
                      Restaurant staff
                    </button>
                  </li>
                  <li>
                    <button onClick={() => go("/restaurant/register")} className="transition-colors hover:text-foreground">
                      Register a venue
                    </button>
                  </li>
                  <li>
                    <button onClick={() => go("/login")} className="transition-colors hover:text-foreground">
                      Platform admin
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Fastap OS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
