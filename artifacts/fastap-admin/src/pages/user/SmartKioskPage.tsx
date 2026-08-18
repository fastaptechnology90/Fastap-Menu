import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { computeBillQuote } from "@/lib/paymentCatalog";
import {
  KIOSK_FEATURES, KIOSK_PAYMENT_MODES, type KioskCartItem, type KioskToken,
} from "@/lib/smartKioskCatalog";
import {
  ChevronLeft, Monitor, ShoppingCart, CreditCard, Nfc, QrCode,
  Ticket, Plus, Minus, CheckCircle, Loader, RefreshCw,
} from "lucide-react";

type Tab = "order" | "checkout" | "nfc" | "qr" | "token";

const TAB_MAP: Record<Tab, string> = {
  order: "self_ordering", checkout: "self_checkout", nfc: "nfc_tap_ordering",
  qr: "qr_self_payment", token: "token_display",
};

export default function SmartKioskPage() {
  const [, navigate] = useAppLocation();
  const { venue } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const slug = venue.restaurantSlug || params.get("slug") || "spice-garden";

  const { toast: pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("order");
  const [menu, setMenu] = useState<{ id: number; name: string; price: number; category: string; spice: number; veg: boolean }[]>([]);
  const [cart, setCart] = useState<KioskCartItem[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [nfcTags, setNfcTags] = useState<{ id: string; label: string; item: string; price: number; menuItemId: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("qr");
  const [tip, setTip] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<KioskToken | null>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [tokenBoard, setTokenBoard] = useState<KioskToken[]>([]);
  const [nfcPulse, setNfcPulse] = useState(false);

  const bill = useMemo(() => computeBillQuote({ subtotal: cart.reduce((s, i) => s + i.price * i.quantity, 0), tip }), [cart, tip]);

  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [cfg, menuRes, board] = await Promise.all([
        publicApi.kiosk.config(slug),
        publicApi.kiosk.menu(slug),
        publicApi.kiosk.tokenBoard(slug),
      ]);
      setConfig(cfg);
      setMenu(menuRes.menu ?? []);
      setTokenBoard(board.tokens ?? []);
      setNfcTags(cfg.nfcTags ?? []);
    } catch {
      setApiError("Could not load kiosk data.");
      setMenu([]);
      setTokenBoard([]);
      setConfig(null);
      setNfcTags([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== "qr" || cart.length === 0) return;
    publicApi.kiosk.qrPayment({ restaurantId: venue.restaurantId ?? 1, amount: bill.grandTotal })
      .then(setQrData)
      .catch(() => setQrData(null));
  }, [tab, cart, bill.grandTotal, venue.restaurantId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function addItem(item: { id: number; name: string; price: number }) {
    setCart(prev => {
      const ex = prev.find(c => c.menuItemId === item.id);
      if (ex) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
    showToast(`${item.name} added`);
  }

  function updateQty(id: number, delta: number) {
    setCart(prev => prev.map(c => c.menuItemId === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  }

  async function handleNfcTap(tagId: string) {
    setNfcPulse(true);
    setTimeout(() => setNfcPulse(false), 600);
    try {
      const res = await publicApi.kiosk.nfcTap({ tagId, cart });
      if (res.action === "pay") {
        setTab("checkout");
        setPaymentMethod("nfc");
        showToast(res.message);
      } else {
        setCart(res.cart);
        showToast(res.message);
      }
    } catch {
      pushToast({ title: "Error", description: "NFC tap failed.", variant: "destructive" });
    }
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await publicApi.kiosk.checkout({
        restaurantId: venue.restaurantId ?? 1,
        items: cart,
        paymentMethod,
        tip,
      });
      setActiveToken(res);
      setCart([]);
      setTab("token");
      showToast(`Token ${res.tokenNumber} issued`);
      load();
    } catch {
      pushToast({ title: "Error", description: "Checkout failed.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Monitor }[] = [
    { id: "order", label: "Order", icon: Monitor },
    { id: "checkout", label: "Checkout", icon: CreditCard },
    { id: "nfc", label: "NFC", icon: Nfc },
    { id: "qr", label: "QR Pay", icon: QrCode },
    { id: "token", label: "Token", icon: Ticket },
  ];

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-28 select-none">
      <div className="guest-header border-b border-violet-500/20">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-violet-300/60">Smart Kiosk & Self Ordering</p>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Monitor className="h-5 w-5 text-violet-400" /> Self-Service Kiosk
            </h1>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setTab("checkout")} className="relative h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-violet-300" />
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-orange-500 text-[10px] font-bold flex items-center justify-center">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </button>
          )}
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold ${
                tab === t.id ? "bg-violet-500/30 border border-violet-500/50 text-violet-200" : "bg-white/5 border border-white/10 text-white/50"
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {loading && <GuestLoading label="Loading kiosk…" />}
        {!loading && apiError && (
          <GuestError message={apiError} onRetry={load} />
        )}
        {!loading && !apiError && (
        <>
        {/* Feature overview */}
        <div className="grid grid-cols-2 gap-2">
          {KIOSK_FEATURES.map(f => (
            <button key={f.id} onClick={() => {
              const t = Object.entries(TAB_MAP).find(([, v]) => v === f.id)?.[0] as Tab | undefined;
              if (t) setTab(t);
            }}
              className={`rounded-xl border p-3 text-left ${TAB_MAP[tab] === f.id ? "border-violet-500/40 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
              <span className="text-xl">{f.icon}</span>
              <p className="text-xs font-semibold mt-1">{f.label}</p>
            </button>
          ))}
        </div>

        {config?.welcomeMessage && tab === "order" && (
          <div className="rounded-xl bg-violet-500/15 border border-violet-500/30 p-4 text-center">
            <p className="text-lg font-bold text-violet-200">{config.welcomeMessage}</p>
            <p className="text-xs text-white/40 mt-1">Tap items to add · Self checkout when ready</p>
          </div>
        )}

        {/* Self Ordering */}
        {tab === "order" && (
          menu.length === 0 ? (
            <GuestEmpty message="No kiosk menu items available." />
          ) : (
          <div className="grid grid-cols-2 gap-3">
            {menu.map(item => (
              <button key={item.id} onClick={() => addItem(item)}
                className="rounded-2xl bg-white/5 border border-white/10 p-4 text-left hover:border-violet-500/40 active:scale-95 transition-all min-h-[120px]">
                <p className="font-bold text-sm leading-tight">{item.name}</p>
                <p className="text-[10px] text-white/40 mt-1">{item.category}</p>
                <p className="text-lg font-extrabold text-orange-400 mt-2">₹{item.price}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-white/30">{item.veg ? "🟢 Veg" : "🔴 Non-Veg"}</span>
                  <Plus className="h-5 w-5 text-violet-400" />
                </div>
              </button>
            ))}
          </div>
          )
        )}

        {/* Self Checkout */}
        {tab === "checkout" && (
          <>
            <p className="text-sm text-white/50">{KIOSK_FEATURES[1].desc}</p>
            {cart.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Cart empty — add items from Order tab</p>
                <button onClick={() => setTab("order")} className="mt-4 px-6 py-3 rounded-xl bg-violet-500 font-semibold text-sm">Browse Menu</button>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5">
                  {cart.map(item => (
                    <div key={item.menuItemId} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-sm text-orange-400">₹{item.price * item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-1">
                        <button onClick={() => updateQty(item.menuItemId, -1)} className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="h-4 w-4" /></button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.menuItemId, 1)} className="h-9 w-9 rounded-lg bg-violet-500 flex items-center justify-center"><Plus className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-white/60"><span>Subtotal</span><span>₹{bill.subtotal}</span></div>
                  <div className="flex justify-between text-white/60"><span>GST (5%)</span><span>₹{bill.gst.totalGst}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10"><span>Total</span><span className="text-orange-400">₹{bill.grandTotal}</span></div>
                </div>

                <p className="text-sm font-semibold">Payment method</p>
                <div className="grid grid-cols-3 gap-2">
                  {KIOSK_PAYMENT_MODES.map(m => (
                    <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                      className={`p-3 rounded-xl border text-center text-xs font-semibold ${paymentMethod === m.id ? "border-violet-500/50 bg-violet-500/20 text-violet-200" : "border-white/10 bg-white/5"}`}>
                      <span className="text-lg block">{m.icon}</span>{m.label}
                    </button>
                  ))}
                </div>

                <button onClick={handleCheckout} disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                  Complete Self Checkout · ₹{bill.grandTotal}
                </button>
              </>
            )}
          </>
        )}

        {/* NFC Tap Ordering */}
        {tab === "nfc" && (
          <>
            <p className="text-sm text-white/50">{KIOSK_FEATURES[2].desc}</p>
            <div className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${nfcPulse ? "border-emerald-400 bg-emerald-500/20 scale-105" : "border-violet-500/40 bg-violet-500/5"}`}>
              <Nfc className={`h-16 w-16 mx-auto mb-3 ${nfcPulse ? "text-emerald-400" : "text-violet-400"}`} />
              <p className="font-bold text-lg">Tap NFC Tag Here</p>
              <p className="text-xs text-white/40 mt-1">Hold phone near kiosk NFC reader</p>
            </div>
            <div className="space-y-2">
              {nfcTags.length === 0 ? (
                <GuestEmpty message="No NFC tags configured." />
              ) : nfcTags.map(tag => (
                <button key={tag.id} onClick={() => handleNfcTap(tag.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 text-left">
                  <Nfc className="h-6 w-6 text-emerald-400" />
                  <div className="flex-1">
                    <p className="font-semibold">{tag.label}</p>
                    <p className="text-xs text-white/40">{tag.item}{tag.price > 0 ? ` · ₹${tag.price}` : " · Pay"}</p>
                  </div>
                  <span className="text-xs text-emerald-400">Simulate tap</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* QR Self Payment */}
        {tab === "qr" && (
          <>
            <p className="text-sm text-white/50">{KIOSK_FEATURES[3].desc}</p>
            {cart.length === 0 ? (
              <p className="text-center text-white/40 py-8">Add items first, then scan QR to pay ₹{bill.grandTotal || "—"}</p>
            ) : (
              <div className="rounded-2xl bg-white p-6 text-center">
                {qrData?.qrImageUrl ? (
                  <img src={qrData.qrImageUrl} alt="UPI QR Code" className="mx-auto w-48 h-48" />
                ) : (
                  <div className="mx-auto w-48 h-48 bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 text-sm">QR Code</div>
                )}
                <p className="text-gray-800 font-bold mt-3 text-lg">₹{bill.grandTotal}</p>
                <p className="text-gray-500 text-xs mt-1">{qrData?.upiId ?? "spicegarden@upi"}</p>
                <p className="text-gray-400 text-[10px] mt-2">Scan with PhonePe, GPay, Paytm or any UPI app</p>
              </div>
            )}
            <button onClick={() => { setPaymentMethod("qr"); handleCheckout(); }}
              disabled={cart.length === 0 || submitting}
              className="w-full py-4 rounded-2xl bg-emerald-600 font-bold disabled:opacity-40">
              I've Paid via QR · Confirm Order
            </button>
          </>
        )}

        {/* Token Display */}
        {tab === "token" && (
          <>
            <p className="text-sm text-white/50">{KIOSK_FEATURES[4].desc}</p>

            {activeToken && (
              <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-orange-600/20 border-2 border-violet-500/50 p-6 text-center">
                <p className="text-xs text-violet-300 uppercase tracking-widest">Your Token</p>
                <p className="text-6xl font-black text-white my-3">{activeToken.tokenNumber}</p>
                <p className="text-sm text-emerald-400 capitalize">{activeToken.status} · ~{activeToken.estimatedMinutes} min</p>
                <p className="text-xs text-white/40 mt-2">Paid via {activeToken.paymentMethod} · ₹{activeToken.total}</p>
              </div>
            )}

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Live Token Board</p>
                <button onClick={load} className="text-violet-400"><RefreshCw className="h-4 w-4" /></button>
              </div>
              <div className="space-y-2">
                {tokenBoard.length === 0 ? (
                  <GuestEmpty message="No tokens on the board." />
                ) : tokenBoard.map((t: { token?: string; tokenNumber?: string; status: string; order?: string; orderSummary?: string }) => (
                  <div key={t.token ?? t.tokenNumber} className={`flex items-center justify-between p-3 rounded-xl border ${
                    t.status === "ready" ? "border-emerald-500/40 bg-emerald-500/10" :
                    t.status === "preparing" ? "border-amber-500/40 bg-amber-500/10" :
                    "border-white/10 bg-white/5"
                  }`}>
                    <div>
                      <p className="text-xl font-black">{t.token ?? t.tokenNumber}</p>
                      <p className="text-[10px] text-white/40 truncate max-w-[180px]">{t.order ?? t.orderSummary}</p>
                    </div>
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                      t.status === "ready" ? "text-emerald-400 bg-emerald-500/20" :
                      t.status === "preparing" ? "text-amber-400 bg-amber-500/20" : "text-white/50 bg-white/10"
                    }`}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        </>
        )}
      </div>

      {cart.length > 0 && tab === "order" && !loading && !apiError && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0b1120]/95 backdrop-blur border-t border-violet-500/20 px-4 py-3">
          <button onClick={() => setTab("checkout")} className="w-full py-4 rounded-2xl bg-violet-600 font-bold text-lg flex items-center justify-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Checkout · ₹{bill.grandTotal} ({cart.reduce((s, i) => s + i.quantity, 0)} items)
          </button>
        </div>
      )}
    </div>
  );
}
