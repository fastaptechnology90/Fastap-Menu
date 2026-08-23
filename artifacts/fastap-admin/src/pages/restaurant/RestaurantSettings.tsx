import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { restaurantApi, restaurantSettingsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Store, Clock, Bell, Shield, Printer, Wifi, CreditCard,
  Globe, Palette, ChevronRight, Save, CheckCircle, QrCode
} from "lucide-react";

const SETTING_SECTIONS = [
  { id: "profile", label: "Restaurant Profile", icon: Store, desc: "Name, address, contact, GST" },
  { id: "hours", label: "Operating Hours", icon: Clock, desc: "Open/close times, holidays" },
  { id: "notifications", label: "Notifications", icon: Bell, desc: "Alert preferences" },
  { id: "security", label: "Security", icon: Shield, desc: "2FA, session, device management" },
  { id: "printer", label: "Printer & KOT", icon: Printer, desc: "Receipt & kitchen printer setup" },
  { id: "payments", label: "Payment Settings", icon: CreditCard, desc: "UPI, POS, payment modes" },
  { id: "branding", label: "Branding & Theme", icon: Palette, desc: "Logo, colors, QR design" },
  { id: "integrations", label: "Integrations", icon: Wifi, desc: "POS, Zomato, Swiggy, accounting" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function RestaurantSettings() {
  const { restaurant, restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [branding, setBranding] = useState<{ brandColor: string; logo: string }>({ brandColor: "#f59e0b", logo: "" });
  const [profile, setProfile] = useState({
    name: restaurant.name,
    branch: restaurant.branch,
    address: restaurant.address,
    phone: restaurant.phone,
    email: restaurant.email,
    gstNumber: restaurant.gstNumber,
    fssaiNumber: restaurant.fssaiNumber,
    cuisineType: restaurant.cuisineType,
    totalTables: restaurant.totalTables,
    totalSeats: restaurant.totalSeats,
  });
  const [hours, setHours] = useState(DAYS.map(d => ({ day: d, open: true, from: d === "Sunday" ? "12:00" : "11:00", to: d === "Sunday" ? "21:00" : "23:00" })));
  const [notifs, setNotifs] = useState({
    newOrder: true, orderReady: true, lowStock: true, newReservation: true,
    staffAlert: false, dailyReport: true, smsAlerts: false, whatsappAlerts: true, emailAlerts: true,
  });
  const [security, setSecurity] = useState({ twoFA: true, sessionTimeout: 60, deviceWhitelist: false, loginAlerts: true, ipRestriction: false });
  const [payments, setPayments] = useState({ upi: true, card: true, cash: true, wallet: true, nfc: false, qrPayment: true, autoGST: true, autoPrint: false, tipEnabled: true });

  useEffect(() => {
    if (!restaurantId) return;
    restaurantApi.get(restaurantId).then((data: any) => {
      if (data) setProfile(prev => ({ ...prev, name: data.name || prev.name, address: data.address || prev.address, phone: data.phone || prev.phone, email: data.email || prev.email, gstNumber: data.gstNumber || prev.gstNumber, fssaiNumber: data.fssaiNumber || prev.fssaiNumber, cuisineType: data.cuisineType || prev.cuisineType, totalTables: data.totalTables || prev.totalTables, totalSeats: data.totalSeats || prev.totalSeats }));
    }).catch(() => {});
    restaurantSettingsApi.getApp(restaurantId).then((data: any) => {
      if (data?.hours) setHours(data.hours);
      if (data?.notifications) setNotifs(data.notifications);
      if (data?.security) setSecurity(data.security);
      if (data?.payments) setPayments(data.payments);
      if (data?.branding) setBranding((prev) => ({
        brandColor: data.branding.brandColor || prev.brandColor,
        logo: data.branding.logo || prev.logo,
      }));
    }).catch(() => {});
  }, [restaurantId]);

  function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Logo too large", description: "Please choose an image under 2 MB." });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBranding((p) => ({ ...p, logo: String(reader.result || "") }));
    reader.onerror = () => toast({ variant: "destructive", title: "Could not read image" });
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleSave() {
    if (!restaurantId) return;
    try {
      // Owner profile persists name/address/phone/email; app settings persist the rest incl. branding.
      await Promise.all([
        restaurantApi.update(restaurantId, profile),
        restaurantSettingsApi.updateApp(restaurantId, { hours, notifications: notifs, security, payments, branding }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || "Could not save settings. Please try again." });
    }
  }

  const activeSec = SETTING_SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/5 bg-[#0e1520] overflow-y-auto">
        <div className="p-4">
          <h2 className="font-bold text-sm mb-3">Settings</h2>
          <div className="space-y-0.5">
            {SETTING_SECTIONS.map(sec => (
              <button key={sec.id} onClick={() => setActiveSection(sec.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${activeSection === sec.id ? "bg-amber-500/15 text-amber-300" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>
                <sec.icon className={`h-4 w-4 shrink-0 ${activeSection === sec.id ? "text-amber-400" : "text-white/30"}`} />
                <div>
                  <p className="text-xs font-semibold">{sec.label}</p>
                  <p className="text-xs text-white/30">{sec.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 lg:p-7">
        <div className="max-w-2xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-extrabold">{activeSec?.label}</h1>
              <p className="text-xs text-white/40">{activeSec?.desc}</p>
            </div>
            {saved && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                <CheckCircle className="h-4 w-4" /> Saved!
              </div>
            )}
          </div>

          {/* Restaurant Profile */}
          {activeSection === "profile" && (
            <div className="space-y-4">
              {[
                { label: "Restaurant Name", field: "name" },
                { label: "Branch", field: "branch" },
                { label: "Address", field: "address" },
                { label: "Phone Number", field: "phone" },
                { label: "Email Address", field: "email" },
                { label: "GST Number", field: "gstNumber" },
                { label: "FSSAI License", field: "fssaiNumber" },
                { label: "Cuisine Type", field: "cuisineType" },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs text-white/40 mb-1.5">{label}</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/40" value={(profile as any)[field]} onChange={e => setProfile({ ...profile, [field]: e.target.value })} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Total Tables</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/40" value={profile.totalTables} onChange={e => setProfile({ ...profile, totalTables: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Total Seats</label>
                  <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/40" value={profile.totalSeats} onChange={e => setProfile({ ...profile, totalSeats: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}

          {/* Operating Hours */}
          {activeSection === "hours" && (
            <div className="space-y-3">
              {hours.map((h, i) => (
                <div key={h.day} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <button onClick={() => setHours(p => p.map((x, j) => j === i ? { ...x, open: !x.open } : x))} className={`w-10 h-5 rounded-full transition-all relative ${h.open ? "bg-amber-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${h.open ? "left-5" : "left-0.5"}`} />
                  </button>
                  <span className="w-24 text-sm font-medium">{h.day}</span>
                  {h.open ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500/40 text-white [color-scheme:dark]" value={h.from} onChange={e => setHours(p => p.map((x, j) => j === i ? { ...x, from: e.target.value } : x))} />
                      <span className="text-white/30 text-sm">to</span>
                      <input type="time" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500/40 text-white [color-scheme:dark]" value={h.to} onChange={e => setHours(p => p.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} />
                    </div>
                  ) : (
                    <span className="text-sm text-white/30">Closed</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notifications */}
          {activeSection === "notifications" && (
            <div className="space-y-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">In-App Alerts</p>
              {[
                { key: "newOrder", label: "New Order Received", desc: "Alert when new order comes in" },
                { key: "orderReady", label: "Order Ready", desc: "Alert when kitchen marks order ready" },
                { key: "lowStock", label: "Low Stock Alert", desc: "When inventory below minimum" },
                { key: "newReservation", label: "New Reservation", desc: "Alert on new table booking" },
                { key: "staffAlert", label: "Staff Check-in/out", desc: "When staff logs in or out" },
                { key: "dailyReport", label: "Daily Report", desc: "End-of-day summary" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-white/40">{desc}</p>
                  </div>
                  <button onClick={() => setNotifs(p => ({ ...p, [key]: !p[key as keyof typeof p] }))} className={`w-10 h-5 rounded-full transition-all relative ${(notifs as any)[key] ? "bg-amber-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${(notifs as any)[key] ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
              <p className="text-xs text-white/40 uppercase tracking-wider pt-2">Channels</p>
              {[
                { key: "smsAlerts", label: "SMS Alerts" },
                { key: "whatsappAlerts", label: "WhatsApp Alerts" },
                { key: "emailAlerts", label: "Email Alerts" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <p className="text-sm font-medium">{label}</p>
                  <button onClick={() => setNotifs(p => ({ ...p, [key]: !p[key as keyof typeof p] }))} className={`w-10 h-5 rounded-full transition-all relative ${(notifs as any)[key] ? "bg-amber-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${(notifs as any)[key] ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Security */}
          {activeSection === "security" && (
            <div className="space-y-3">
              {[
                { key: "twoFA", label: "Two-Factor Authentication (2FA)", desc: "Require OTP at login" },
                { key: "loginAlerts", label: "Login Alerts", desc: "Notify on new device login" },
                { key: "deviceWhitelist", label: "Device Whitelist", desc: "Only allow approved devices" },
                { key: "ipRestriction", label: "IP Restriction", desc: "Restrict access by IP address" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-white/40">{desc}</p>
                  </div>
                  <button onClick={() => setSecurity(p => ({ ...p, [key]: !p[key as keyof typeof p] }))} className={`w-10 h-5 rounded-full transition-all relative ${(security as any)[key] === true ? "bg-amber-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${(security as any)[key] === true ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Session Timeout (minutes)</label>
                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/40" value={security.sessionTimeout} onChange={e => setSecurity({ ...security, sessionTimeout: Number(e.target.value) })} />
              </div>
            </div>
          )}

          {/* Payment Settings */}
          {activeSection === "payments" && (
            <div className="space-y-3">
              <p className="text-xs text-white/40 uppercase tracking-wider">Accepted Payment Methods</p>
              {[
                { key: "upi", label: "UPI Payments", desc: "PhonePe, GPay, Paytm" },
                { key: "card", label: "Debit/Credit Cards", desc: "Visa, Mastercard, RuPay" },
                { key: "cash", label: "Cash Payments" },
                { key: "wallet", label: "Digital Wallets", desc: "In-app wallet balance" },
                { key: "nfc", label: "NFC Contactless", desc: "Tap-to-pay" },
                { key: "qrPayment", label: "QR Code Payment" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    {desc && <p className="text-xs text-white/40">{desc}</p>}
                  </div>
                  <button onClick={() => setPayments(p => ({ ...p, [key]: !p[key as keyof typeof p] }))} className={`w-10 h-5 rounded-full transition-all relative ${(payments as any)[key] ? "bg-amber-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${(payments as any)[key] ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
              <p className="text-xs text-white/40 uppercase tracking-wider pt-2">Billing Settings</p>
              {[
                { key: "autoGST", label: "Auto-apply GST (5%)" },
                { key: "autoPrint", label: "Auto-print receipt after payment" },
                { key: "tipEnabled", label: "Enable tip option at billing" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8">
                  <p className="text-sm font-medium">{label}</p>
                  <button onClick={() => setPayments(p => ({ ...p, [key]: !p[key as keyof typeof p] }))} className={`w-10 h-5 rounded-full transition-all relative ${(payments as any)[key] ? "bg-amber-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${(payments as any)[key] ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Branding */}
          {activeSection === "branding" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-5 text-center">
                {branding.logo ? (
                  <img src={branding.logo} alt="Restaurant logo" className="h-20 w-20 rounded-2xl object-cover border border-white/10 mx-auto mb-3" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-amber-500/20 border-2 border-dashed border-amber-500/40 flex items-center justify-center text-3xl mx-auto mb-3">🍽️</div>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <div className="flex items-center justify-center gap-2">
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold">Upload Logo</button>
                  {branding.logo && (
                    <button type="button" onClick={() => setBranding(p => ({ ...p, logo: "" }))} className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold text-white/50">Remove</button>
                  )}
                </div>
                <p className="text-xs text-white/30 mt-2">Saved with Save Changes below.</p>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Brand Color</label>
                <div className="flex gap-2">
                  {["#f59e0b", "#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444"].map(color => (
                    <button key={color} type="button" onClick={() => setBranding(p => ({ ...p, brandColor: color }))} className={`h-8 w-8 rounded-xl border-2 transition-all ${branding.brandColor === color ? "border-white ring-2 ring-white/40" : "border-white/20 hover:border-white/50"}`} style={{ backgroundColor: color }} aria-label={`Brand color ${color}`} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <QrCode className="h-8 w-8 text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold">QR Code Generator</p>
                    <p className="text-xs text-white/40">Generate table QR codes</p>
                  </div>
                </div>
                <button type="button" onClick={() => navigate("/restaurant/qr-management")} className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/30">Generate</button>
              </div>
            </div>
          )}

          {/* Integrations */}
          {activeSection === "integrations" && (
            <div className="space-y-3">
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300">
                Static preview — connection status shown below is sample data. <strong>NEEDS API</strong>: no integrations endpoint is wired yet, so Connect / Disconnect are not functional.
              </div>
              {[
                { name: "Zomato", icon: "🔴", status: "connected", desc: "Menu sync & online orders" },
                { name: "Swiggy", icon: "🟠", status: "disconnected", desc: "Delivery integration" },
                { name: "Razorpay", icon: "💳", status: "connected", desc: "Payment gateway" },
                { name: "Tally ERP", icon: "📊", status: "disconnected", desc: "Accounting integration" },
                { name: "WhatsApp Business", icon: "💬", status: "connected", desc: "Customer notifications" },
                { name: "Google Analytics", icon: "📈", status: "disconnected", desc: "Traffic & insights" },
              ].map(int => (
                <div key={int.name} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/8">
                  <span className="text-2xl">{int.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{int.name}</p>
                    <p className="text-xs text-white/40">{int.desc}</p>
                  </div>
                  <button disabled title="NEEDS API — integrations endpoint not available" className={`px-3 py-1.5 rounded-lg text-xs font-semibold border opacity-60 cursor-not-allowed ${int.status === "connected" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "border-white/10 bg-white/5 text-white/50"}`}>
                    {int.status === "connected" ? "✓ Connected" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Printer */}
          {activeSection === "printer" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300">
                Static preview — printer list below is sample data. <strong>NEEDS API</strong>: no printer/KOT configuration endpoint is wired yet.
              </div>
              {[
                { label: "Receipt Printer", icon: "🖨️", status: "connected", model: "Epson TM-T82III" },
                { label: "Kitchen Printer", icon: "🍳", status: "connected", model: "Star SP742" },
                { label: "Label Printer", icon: "🏷️", status: "disconnected", model: "Not configured" },
              ].map(p => (
                <div key={p.label} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/8">
                  <span className="text-2xl">{p.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="text-xs text-white/40">{p.model}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "connected" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/30"}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Save Button */}
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all">
            <Save className="h-4 w-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
