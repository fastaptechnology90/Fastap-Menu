import { useState, useEffect, useMemo } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useGuestBack } from "@/hooks/useGuestBack";
import { withGuestQuery } from "@/lib/guestDemo";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  PAYMENT_MODES, TIP_PRESETS, computeBillQuote, validateSplitPayments,
  paymentModeLabel, type PaymentModeId, type SplitPaymentLine,
} from "@/lib/paymentCatalog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, Receipt, Users, Wallet, CheckCircle, FileText, Download,
  Split, Percent, Clock, QrCode, Smartphone, CreditCard, Banknote, Nfc, Building2,
} from "lucide-react";

const MODE_ICONS: Record<PaymentModeId, typeof Smartphone> = {
  upi: Smartphone, card: CreditCard, cash: Banknote, nfc: Nfc, qr: QrCode, wallet: Wallet, netbanking: Building2,
};

type BillingTab = "standard" | "split" | "partial" | "advance";

export default function PaymentPage() {
  const [, navigate] = useAppLocation();
  const { cart, cartTotal, user, placeOrder, venue, activeTable, smartEntry } = useUser();
  const goBack = useGuestBack(cart.length ? "/user/cart" : "/user/menu");
  const { toast } = useToast();

  const subtotal = cartTotal;
  const [discount, setDiscount] = useState(0);
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentModeId>("upi");
  const [billingTab, setBillingTab] = useState<BillingTab>("standard");
  const [splitCount, setSplitCount] = useState(2);
  const [splitMode, setSplitMode] = useState<"equal" | "multi">("equal");
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([
    { method: "upi", amount: 0 },
    { method: "wallet", amount: 0 },
  ]);
  const [partialPayNow, setPartialPayNow] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ orderId: string; invoiceNumber?: string } | null>(null);
  const [showQr, setShowQr] = useState(false);

  const localQuote = useMemo(() => computeBillQuote({
    subtotal,
    discount,
    tip: customTip ? parseFloat(customTip) || tip : tip,
    splitCount: billingTab === "split" && splitMode === "equal" ? splitCount : undefined,
    partialPayNow: billingTab === "partial" && partialPayNow ? parseFloat(partialPayNow) : undefined,
    advanceAmount: billingTab === "advance" && advanceAmount ? parseFloat(advanceAmount) : undefined,
  }), [subtotal, discount, tip, customTip, billingTab, splitCount, splitMode, partialPayNow, advanceAmount]);

  const [serverQuote, setServerQuote] = useState<typeof localQuote | null>(null);
  const [paymentCatalog, setPaymentCatalog] = useState<{
    paymentGateways?: string[];
    defaultPaymentGateway?: string;
    activeGateway?: string;
    clientConfig?: { gatewayId?: string; demoMode?: boolean; keyId?: string } | null;
  } | null>(null);

  useEffect(() => {
    publicApi.payments.catalog().then(setPaymentCatalog).catch(() => setPaymentCatalog(null));
  }, []);

  useEffect(() => {
    if (!venue.restaurantId) {
      setServerQuote(null);
      return;
    }
    const tipVal = customTip ? parseFloat(customTip) || tip : tip;
    publicApi.payments.quote({
      subtotal,
      discount,
      tip: tipVal,
      splitCount: billingTab === "split" && splitMode === "equal" ? splitCount : undefined,
      partialPayNow: billingTab === "partial" && partialPayNow ? parseFloat(partialPayNow) : undefined,
      advanceAmount: billingTab === "advance" && advanceAmount ? parseFloat(advanceAmount) : undefined,
    }).then(setServerQuote).catch(() => setServerQuote(null));
  }, [venue.restaurantId, subtotal, discount, tip, customTip, billingTab, splitCount, splitMode, partialPayNow, advanceAmount]);

  const quote = serverQuote ?? localQuote;

  useEffect(() => {
    if (billingTab === "split" && splitMode === "multi") {
      const half = Math.round(quote.grandTotal / 2);
      setSplitLines([
        { method: splitLines[0]?.method ?? "upi", amount: half },
        { method: splitLines[1]?.method ?? "wallet", amount: quote.grandTotal - half },
      ]);
    }
  }, [quote.grandTotal, billingTab, splitMode]);

  const payAmount = billingTab === "partial" && quote.partialPayNow
    ? quote.partialPayNow
    : billingTab === "advance" && quote.advanceAmount
      ? quote.advanceAmount
      : quote.grandTotal;

  const activeGateway = paymentCatalog?.activeGateway ?? paymentCatalog?.defaultPaymentGateway;
  const gatewayReady = (paymentCatalog?.paymentGateways?.length ?? 0) > 0;
  const isDemoGateway = paymentCatalog?.clientConfig?.demoMode === true;
  const onlineMethodsBlocked = !gatewayReady && paymentMethod !== "cash";

  async function handlePay() {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", description: "Add items before checkout.", variant: "destructive" });
      return;
    }
    if (paymentMethod !== "cash" && !gatewayReady) {
      toast({
        title: "Payments unavailable",
        description: "Enable a payment gateway in Super Admin → Settings → Integrations.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const splits = billingTab === "split" && splitMode === "multi" && validateSplitPayments(splitLines, quote.grandTotal)
        ? splitLines
        : billingTab === "split" && splitMode === "equal"
          ? Array.from({ length: splitCount }, (_, i) => ({
              method: i === 0 ? paymentMethod : "upi" as PaymentModeId,
              amount: quote.splitPerPerson ?? Math.ceil(quote.grandTotal / splitCount),
            }))
          : undefined;

      const hadCartItems = cart.length > 0;
      const order = await placeOrder({
        paymentMethod,
        tip: quote.tip,
        discount,
        splitPayments: splits,
        partialPayNow: billingTab === "partial" ? parseFloat(partialPayNow) : undefined,
        advanceAmount: billingTab === "advance" ? parseFloat(advanceAmount) : undefined,
        splitBilling: billingTab === "split" && splitMode === "equal"
          ? { enabled: true, count: splitCount, perPerson: quote.splitPerPerson ?? 0 }
          : undefined,
      });

      const numericId = parseInt(String(order.id).replace(/\D/g, ""), 10);
      if (numericId && venue.restaurantId && hadCartItems) {
        try {
          await publicApi.payments.process(numericId, {
            paymentMethod,
            tipAmount: quote.tip,
            splitPayments: splits,
            partialPayNow: billingTab === "partial" && partialPayNow ? parseFloat(partialPayNow) : undefined,
            advanceAmount: billingTab === "advance" && advanceAmount ? parseFloat(advanceAmount) : undefined,
          });
          const inv = await publicApi.payments.invoice(numericId);
          setSuccess({ orderId: String(numericId), invoiceNumber: inv.invoice?.invoiceNumber });
        } catch {
          setSuccess({ orderId: String(order.id), invoiceNumber: undefined });
        }
      } else {
        setSuccess({ orderId: String(order.id), invoiceNumber: undefined });
      }
    } catch {
      toast({ title: "Payment failed", description: "Could not complete payment. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadInvoice(type: "gst" | "pdf") {
    if (!success?.orderId) return;
    const id = parseInt(success.orderId.replace(/\D/g, ""), 10);
    if (!id) {
      toast({ title: "Invoice unavailable", description: "No invoice found for this order.", variant: "destructive" });
      return;
    }
    try {
      if (type === "pdf") {
        window.open(publicApi.payments.invoicePdf(id), "_blank");
      } else {
        window.open(publicApi.payments.invoiceDownload(id), "_blank");
      }
    } catch {
      const res = await publicApi.payments.invoice(id);
      const blob = new Blob([res.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${res.invoice.invoiceNumber}.html`;
      a.click();
    }
  }

  if (success) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-white flex flex-col items-center justify-center px-6 text-center gap-4 relative">
        <GuestBackButton className="absolute top-4 left-4" />
        <CheckCircle className="h-16 w-16 text-emerald-400" />
        <h2 className="text-2xl font-bold">Payment Successful</h2>
        <p className="text-white/50">₹{payAmount.toLocaleString()} via {paymentModeLabel(paymentMethod)}</p>
        {success.invoiceNumber && <p className="text-sm text-emerald-300 font-mono">{success.invoiceNumber}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={() => downloadInvoice("gst")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm">
            <FileText className="h-4 w-4" /> GST Invoice
          </button>
          <button onClick={() => downloadInvoice("pdf")} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm">
            <Download className="h-4 w-4" /> PDF Invoice
          </button>
        </div>
        <button onClick={() => navigate(withGuestQuery(`/user/order/${success.orderId}`, venue, activeTable))} className="mt-4 text-orange-400 underline text-sm">
          Track order
        </button>
      </div>
    );
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-32">
      <div className="guest-header px-4 py-3 flex items-center gap-3">
        <GuestBackButton onClick={goBack} />
        <div>
          <p className="text-xs text-white/40">Payment System</p>
          <h1 className="text-base font-bold">Checkout & Billing</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {gatewayReady && (
          <div className={`rounded-xl border px-3 py-2 text-xs ${isDemoGateway ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
            {isDemoGateway
              ? `Demo payments via ${activeGateway ?? "gateway"} — add API keys in Super Admin for live processing.`
              : `Secured by ${activeGateway ?? "payment gateway"}`}
          </div>
        )}
        {!gatewayReady && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            No payment gateway enabled. Cash payments only, or enable Razorpay in Super Admin → Integrations.
          </div>
        )}
        {/* Bill with GST breakdown */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Receipt className="h-4 w-4 text-orange-400" /> Bill Summary</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/50">Subtotal</span><span>₹{quote.subtotal}</span></div>
            {quote.discount > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-₹{quote.discount}</span></div>}
            <div className="flex justify-between"><span className="text-white/50">Taxable</span><span>₹{quote.taxableAmount}</span></div>
            <div className="flex justify-between"><span className="text-white/50">CGST (2.5%)</span><span>₹{quote.gst.cgst}</span></div>
            <div className="flex justify-between"><span className="text-white/50">SGST (2.5%)</span><span>₹{quote.gst.sgst}</span></div>
            {quote.tip > 0 && <div className="flex justify-between"><span className="text-white/50">Tip</span><span>₹{quote.tip}</span></div>}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">
              <span>Total</span><span className="text-orange-400">₹{quote.grandTotal}</span>
            </div>
          </div>
        </div>

        {/* Tip Management */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-sm font-semibold mb-3">Tip Management 🙏</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {TIP_PRESETS.map(t => (
              <button key={t} onClick={() => { setTip(t); setCustomTip(""); }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border ${tip === t && !customTip ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "border-white/10 bg-white/5"}`}>
                {t === 0 ? "None" : `₹${t}`}
              </button>
            ))}
          </div>
          <input type="number" placeholder="Custom tip amount" value={customTip} onChange={e => setCustomTip(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" />
        </div>

        {/* Advanced Billing tabs */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-sm font-semibold mb-3">Advanced Billing</p>
          <div className="flex gap-1 mb-3 overflow-x-auto">
            {([
              { id: "standard" as const, label: "Full", icon: Receipt },
              { id: "split" as const, label: "Split", icon: Split },
              { id: "partial" as const, label: "Partial", icon: Percent },
              { id: "advance" as const, label: "Advance", icon: Clock },
            ]).map(t => (
              <button key={t.id} onClick={() => setBillingTab(t.id)}
                className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs border ${billingTab === t.id ? "bg-violet-500/20 border-violet-500/40" : "border-white/10"}`}>
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>

          {billingTab === "split" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button onClick={() => setSplitMode("equal")} className={`flex-1 py-2 rounded-xl text-xs border ${splitMode === "equal" ? "bg-violet-500/20 border-violet-500/40" : "border-white/10"}`}>Equal split</button>
                <button onClick={() => setSplitMode("multi")} className={`flex-1 py-2 rounded-xl text-xs border ${splitMode === "multi" ? "bg-violet-500/20 border-violet-500/40" : "border-white/10"}`}>Multi-method split</button>
              </div>
              {splitMode === "equal" ? (
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-violet-400" />
                  <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="h-8 w-8 rounded-lg bg-white/10">−</button>
                  <span className="flex-1 text-center font-bold">{splitCount} people · ₹{quote.splitPerPerson}/each</span>
                  <button onClick={() => setSplitCount(Math.min(10, splitCount + 1))} className="h-8 w-8 rounded-lg bg-white/10">+</button>
                </div>
              ) : (
                splitLines.map((line, i) => (
                  <div key={i} className="flex gap-2">
                    <select value={line.method} onChange={e => {
                      const next = [...splitLines];
                      next[i] = { ...next[i], method: e.target.value as PaymentModeId };
                      setSplitLines(next);
                    }} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
                      {PAYMENT_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <input type="number" value={line.amount || ""} onChange={e => {
                      const next = [...splitLines];
                      next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 };
                      setSplitLines(next);
                    }} className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="₹" />
                  </div>
                ))
              )}
            </div>
          )}

          {billingTab === "partial" && (
            <div>
              <label className="text-xs text-white/40">Pay now (remaining due later)</label>
              <input type="number" max={quote.grandTotal - 1} value={partialPayNow} onChange={e => setPartialPayNow(e.target.value)}
                placeholder={`Max ₹${quote.grandTotal - 1}`} className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
              {quote.partialRemaining != null && (
                <p className="text-xs text-amber-300 mt-2">Pay now: ₹{quote.partialPayNow} · Remaining: ₹{quote.partialRemaining}</p>
              )}
            </div>
          )}

          {billingTab === "advance" && (
            <div>
              <label className="text-xs text-white/40">Advance payment (balance on delivery)</label>
              <input type="number" max={quote.grandTotal - 1} value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                placeholder="Advance amount" className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm" />
              {quote.balanceDue != null && (
                <p className="text-xs text-violet-300 mt-2">Advance: ₹{quote.advanceAmount} · Balance due: ₹{quote.balanceDue}</p>
              )}
            </div>
          )}
        </div>

        {/* All 7 Payment Modes */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-sm font-semibold mb-3">Payment Mode</p>
          <div className="space-y-2">
            {PAYMENT_MODES.map(m => {
              const Icon = MODE_ICONS[m.id];
              const needsGateway = m.id !== "cash";
              const disabled = needsGateway && !gatewayReady;
              const walletSub = m.id === "wallet" && user?.walletTotal != null ? `Balance: ₹${user.walletTotal}` : m.desc;
              return (
                <button key={m.id} disabled={disabled} onClick={() => { if (!disabled) { setPaymentMethod(m.id); if (m.id === "qr") setShowQr(true); else setShowQr(false); } }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${paymentMethod === m.id ? "bg-orange-500/10 border-orange-500/40" : "border-white/10 bg-white/5"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                  <Icon className={`h-5 w-5 ${paymentMethod === m.id ? "text-orange-400" : "text-white/40"}`} />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs text-white/40">{walletSub}</p>
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 ${paymentMethod === m.id ? "border-orange-500 bg-orange-500" : "border-white/20"}`} />
                </button>
              );
            })}
          </div>
          {showQr && paymentMethod === "qr" && (
            <div className="mt-3 p-4 rounded-xl bg-white text-center">
              <div className="inline-grid grid-cols-5 gap-0.5 p-2">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={`h-3 w-3 ${[0,1,2,4,5,6,10,12,14,18,20,22,24].includes(i) ? "bg-black" : "bg-white"}`} />
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">Scan to pay ₹{payAmount}</p>
            </div>
          )}
          {paymentMethod === "nfc" && smartEntry?.detection?.entryMethod === "nfc" && (
            <p className="mt-2 text-xs text-cyan-300">NFC tap detected — hold device near reader</p>
          )}
        </div>
      </div>

      <div className="guest-bottom-bar">
        <button onClick={handlePay} disabled={submitting || onlineMethodsBlocked}
          className="w-full py-4 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-60 font-bold text-base">
          {submitting ? "Processing…" : `Pay ₹${payAmount} · ${paymentModeLabel(paymentMethod)}`}
        </button>
      </div>
    </div>
  );
}
