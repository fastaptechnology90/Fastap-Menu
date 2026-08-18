import { useState, useEffect, useCallback, useRef } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  SUPPORT_CHANNELS, TICKET_CATEGORIES, VOICE_CALLBACK_SLOTS,
  CHAT_QUICK_REPLIES, EMERGENCY_TYPES,
  type SupportChannelId,
} from "@/lib/liveSupportCatalog";
import {
  ChevronLeft, MessageCircle, Phone, Send, AlertTriangle, Ticket,
  CheckCircle, Headphones, Clock, ExternalLink, Mic, Shield, Loader,
} from "lucide-react";

type Tab = SupportChannelId;

const TAB_ICONS: Record<Tab, typeof MessageCircle> = {
  live_chat: MessageCircle, whatsapp: Phone, voice: Mic, ticket: Ticket, emergency: AlertTriangle,
};

type ChatMsg = { id: number | string; role: "guest" | "agent"; name: string; message: string; at?: string };

export default function UserSupport() {
  const [, navigate] = useAppLocation();
  const { user, venue, activeTable } = useUser();

  const { toast: pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("live_chat");
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live chat
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("Support Agent");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // WhatsApp
  const [waMessage, setWaMessage] = useState("Hi, I need help with my order.");

  // Voice
  const [voicePhone, setVoicePhone] = useState(user?.mobile ?? "");
  const [voiceSlot, setVoiceSlot] = useState(VOICE_CALLBACK_SLOTS[0]);
  const [voiceReason, setVoiceReason] = useState("");

  // Ticket
  const [ticketCategory, setTicketCategory] = useState("order");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [myTickets, setMyTickets] = useState<any[]>([]);

  // Emergency
  const [emergencyType, setEmergencyType] = useState("medical");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const [emergencySent, setEmergencySent] = useState(false);
  const [hotlines, setHotlines] = useState<any>(null);

  const loadConfig = useCallback(async () => {
    if (!venue.restaurantId) {
      setApiError("Restaurant not loaded.");
      setConfigLoading(false);
      return;
    }
    setConfigLoading(true);
    setApiError(null);
    try {
      const c = await publicApi.support.config(venue.restaurantId);
      setConfig(c);
    } catch {
      setApiError("Could not load support configuration.");
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  }, [venue.restaurantId]);

  const startChat = useCallback(async () => {
    if (!venue.restaurantId) {
      pushToast({ title: "Error", description: "Restaurant not available.", variant: "destructive" });
      return;
    }
    try {
      const res = await publicApi.support.startChat({
        restaurantId: venue.restaurantId,
        guestName: user?.name,
      });
      setSessionId(res.sessionId);
      setAgentName(res.agentName);
      setChatMessages([{ id: 0, role: "agent", name: res.agentName, message: res.welcome }]);
    } catch {
      pushToast({ title: "Error", description: "Could not start chat.", variant: "destructive" });
    }
  }, [venue.restaurantId, user?.name, pushToast]);

  const loadTickets = useCallback(async () => {
    if (!user) return;
    try {
      const list = await publicApi.support.myTickets();
      setMyTickets(list ?? []);
    } catch {
      setMyTickets([]);
    }
  }, [user]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { if (tab === "live_chat" && !sessionId) startChat(); }, [tab, sessionId, startChat]);
  useEffect(() => { if (tab === "ticket") loadTickets(); }, [tab, loadTickets]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    if (!sessionId || !venue.restaurantId || tab !== "live_chat") return;
    const poll = async () => {
      try {
        const res = await publicApi.support.chatMessages(sessionId, venue.restaurantId!);
        if (res.messages?.length) {
          setChatMessages(res.messages.map((m: ChatMsg) => ({
            id: m.id,
            role: m.role,
            name: m.name,
            message: m.message,
            at: m.at,
          })));
        }
      } catch { /* polling optional */ }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [sessionId, venue.restaurantId, tab]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function sendChat(text?: string) {
    const msg = (text ?? chatInput).trim();
    if (!msg) return;
    setChatInput("");

    const guestMsg: ChatMsg = { id: Date.now(), role: "guest", name: user?.name ?? "Guest", message: msg };
    setChatMessages(prev => [...prev, guestMsg]);

    if (!venue.restaurantId || !sessionId) {
      pushToast({ title: "Error", description: "Chat session not available.", variant: "destructive" });
      return;
    }

    try {
      const res = await publicApi.support.sendChatMessage(sessionId, {
        restaurantId: venue.restaurantId ?? 1,
        message: msg,
        guestName: user?.name,
        agentName,
      });
      setChatMessages(prev => [...prev, {
        id: res.agentMessage.id,
        role: "agent",
        name: res.agentMessage.name,
        message: res.agentMessage.message,
        at: res.agentMessage.at,
      }]);
    } catch {
      pushToast({ title: "Error", description: "Could not send message.", variant: "destructive" });
    }
  }

  async function openWhatsApp() {
    if (!waMessage.trim()) return;
    setSubmitting(true);
    try {
      const res = await publicApi.support.whatsapp({
        restaurantId: venue.restaurantId ?? 1,
        message: waMessage,
        guestName: user?.name,
        guestPhone: user?.mobile,
      });
      window.open(res.url, "_blank");
      showToast("Opening WhatsApp…");
    } catch {
      pushToast({ title: "Error", description: "Could not open WhatsApp.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function requestVoiceCallback() {
    if (!voicePhone.trim()) { showToast("Enter your phone number"); return; }
    setSubmitting(true);
    try {
      const res = await publicApi.support.voice({
        restaurantId: venue.restaurantId ?? 1,
        guestPhone: voicePhone,
        guestName: user?.name,
        preferredSlot: voiceSlot,
        reason: voiceReason,
      });
      showToast(`Callback scheduled — ${res.estimatedCallback}`);
    } catch {
      pushToast({ title: "Error", description: "Could not request callback.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTicket() {
    if (!ticketMessage.trim()) return;
    setSubmitting(true);
    try {
      const res = await publicApi.support.ticket({
        restaurantId: venue.restaurantId ?? 1,
        channel: "ticket",
        category: ticketCategory,
        subject: ticketSubject || TICKET_CATEGORIES.find(c => c.id === ticketCategory)?.label || "Support request",
        message: ticketMessage,
        guestName: user?.name,
        guestPhone: user?.mobile,
      });
      setMyTickets(prev => [res, ...prev]);
      setTicketSubject("");
      setTicketMessage("");
      showToast(`Ticket ${res.ticketNumber ?? res.id} created`);
    } catch {
      pushToast({ title: "Error", description: "Could not submit ticket.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function sendEmergency() {
    setSubmitting(true);
    try {
      const res = await publicApi.support.emergency({
        restaurantId: venue.restaurantId ?? 1,
        emergencyType,
        message: emergencyMessage,
        guestName: user?.name,
        guestPhone: user?.mobile,
        tableName: activeTable,
        location: activeTable,
      });
      setHotlines(res.hotlines ?? config);
      setEmergencySent(true);
      showToast("Emergency alert sent — staff notified");
    } catch {
      pushToast({ title: "Error", description: "Could not send emergency alert.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const tabs = SUPPORT_CHANNELS.map(c => ({ id: c.id as Tab, label: c.label.split(" ")[0] }));

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-white/40">Live Support System</p>
            <h1 className="text-base font-bold flex items-center gap-2">
              <Headphones className="h-4 w-4 text-cyan-400" /> Guest Support
            </h1>
          </div>
          <div className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
            {config?.agentsOnline ?? 0} online
          </div>
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {tabs.map(t => {
            const Icon = TAB_ICONS[t.id];
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium ${
                  tab === t.id
                    ? t.id === "emergency"
                      ? "bg-red-500/25 border border-red-500/40 text-red-200"
                      : "bg-cyan-500/25 border border-cyan-500/40 text-cyan-200"
                    : "bg-white/5 border border-white/10 text-white/60"
                }`}>
                <Icon className="h-3 w-3" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4">
        {configLoading && <GuestLoading label="Loading support…" />}
        {!configLoading && apiError && (
          <GuestError message={apiError} onRetry={loadConfig} />
        )}
        {!configLoading && !apiError && config && (
        <>
        {/* 5 channels overview */}
        <div className="grid grid-cols-2 gap-2">
          {SUPPORT_CHANNELS.map(c => (
            <button key={c.id} onClick={() => setTab(c.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                tab === c.id ? "border-cyan-500/40 bg-cyan-500/10" : "border-white/10 bg-white/5"
              }`}>
              <span className="text-lg">{c.icon}</span>
              <p className="text-xs font-semibold mt-1">{c.label}</p>
              <p className="text-[10px] text-white/40 line-clamp-2">{c.desc}</p>
              <p className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {c.avgWait}</p>
            </button>
          ))}
        </div>

        <p className="text-xs text-white/40 text-center">{config?.hours ?? ""}</p>

        {/* Live Chat */}
        {tab === "live_chat" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col" style={{ height: "420px" }}>
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-semibold">{agentName} · Live Chat</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === "guest" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "guest" ? "bg-cyan-600/30 border border-cyan-500/30" : "bg-white/5 border border-white/10"
                  }`}>
                    {m.role === "agent" && <p className="text-[10px] text-white/40 mb-0.5">{m.name}</p>}
                    {m.message}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="px-3 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
              {CHAT_QUICK_REPLIES.map(q => (
                <button key={q} onClick={() => sendChat(q)} className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                  {q}
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500/40"
                placeholder="Type a message…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
              />
              <button onClick={() => sendChat()} className="h-10 w-10 rounded-xl bg-cyan-500 flex items-center justify-center">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp */}
        {tab === "whatsapp" && (
          <>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4">
              <p className="text-sm font-semibold text-emerald-200">WhatsApp: {config?.whatsappDisplay ?? "—"}</p>
              <p className="text-xs text-white/50 mt-1">Send photos, receipts, or voice notes directly to our support team.</p>
            </div>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-emerald-500/40"
              value={waMessage}
              onChange={e => setWaMessage(e.target.value)}
              placeholder="Your message to support…"
            />
            <button onClick={openWhatsApp} disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Open WhatsApp Chat
            </button>
          </>
        )}

        {/* Voice Support */}
        {tab === "voice" && (
          <>
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/25 p-4 text-center">
              <Phone className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <p className="text-lg font-bold text-blue-300">{config?.voiceHelplineDisplay ?? "—"}</p>
              <p className="text-xs text-white/50 mt-1">Call directly or request a callback below</p>
              <a href={`tel:${config?.voiceHelpline ?? ""}`} className="inline-block mt-3 px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-semibold">
                Call Now
              </a>
            </div>
            <p className="text-sm font-semibold">Request Callback</p>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
              placeholder="Your phone number"
              value={voicePhone}
              onChange={e => setVoicePhone(e.target.value)}
            />
            <select
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
              value={voiceSlot}
              onChange={e => setVoiceSlot(e.target.value)}
            >
              {VOICE_CALLBACK_SLOTS.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
            </select>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm min-h-[80px]"
              placeholder="Brief reason for call (optional)"
              value={voiceReason}
              onChange={e => setVoiceReason(e.target.value)}
            />
            <button onClick={requestVoiceCallback} disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-blue-600 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Mic className="h-4 w-4" /> Request Voice Callback
            </button>
          </>
        )}

        {/* Ticket Support */}
        {tab === "ticket" && (
          <>
            <p className="text-sm font-semibold">Create Support Ticket</p>
            <div className="flex flex-wrap gap-2">
              {TICKET_CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setTicketCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    ticketCategory === c.id ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200" : "border-white/10 text-white/50"
                  }`}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
              placeholder="Subject (optional)"
              value={ticketSubject}
              onChange={e => setTicketSubject(e.target.value)}
            />
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm min-h-[100px]"
              placeholder="Describe your issue in detail…"
              value={ticketMessage}
              onChange={e => setTicketMessage(e.target.value)}
            />
            <button onClick={submitTicket} disabled={submitting || !ticketMessage.trim()}
              className="w-full py-3.5 rounded-xl bg-cyan-600 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Ticket className="h-4 w-4" /> Submit Ticket
            </button>

            {myTickets.length > 0 && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-sm font-semibold mb-3">My Tickets</p>
                <div className="space-y-2">
                  {myTickets.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs border-b border-white/5 pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{t.ticketNumber ?? `TKT-${t.id}`}</p>
                        <p className="text-white/40 truncate max-w-[200px]">{t.subject}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full capitalize ${
                        t.status === "open" ? "bg-amber-500/20 text-amber-300"
                          : t.status === "in_progress" ? "bg-blue-500/20 text-blue-300"
                            : "bg-emerald-500/20 text-emerald-300"
                      }`}>{t.status?.replace("_", " ") ?? "open"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Emergency Support */}
        {tab === "emergency" && (
          <>
            <div className="rounded-xl bg-red-500/15 border border-red-500/40 p-4">
              <p className="text-sm font-bold text-red-200 flex items-center gap-2">
                <Shield className="h-4 w-4" /> 24/7 Emergency Line: {config?.emergencyDisplay ?? "—"}
              </p>
              <a href={`tel:${config?.emergencyHotline ?? ""}`} className="block mt-2 text-center py-3 rounded-xl bg-red-600 font-bold text-sm">
                CALL EMERGENCY HOTLINE
              </a>
            </div>

            {!emergencySent ? (
              <>
                <p className="text-sm text-white/60">Select emergency type and alert on-site staff immediately:</p>
                <div className="space-y-2">
                  {EMERGENCY_TYPES.map(e => (
                    <button key={e.id} onClick={() => setEmergencyType(e.id)}
                      className={`w-full text-left rounded-xl border p-3 ${
                        emergencyType === e.id ? "border-red-500/50 bg-red-500/10" : "border-white/10 bg-white/5"
                      }`}>
                      <p className="font-semibold text-sm">{e.icon} {e.label}</p>
                      <p className="text-xs text-white/40">{e.desc}</p>
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm min-h-[80px]"
                  placeholder="Additional details (location, table number, etc.)"
                  value={emergencyMessage}
                  onChange={e => setEmergencyMessage(e.target.value)}
                />
                <button onClick={sendEmergency} disabled={submitting}
                  className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <AlertTriangle className="h-5 w-5" /> SEND EMERGENCY ALERT
                </button>
              </>
            ) : (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center space-y-3">
                <CheckCircle className="h-10 w-10 text-red-400 mx-auto" />
                <p className="font-bold text-red-200">Emergency Alert Sent</p>
                <p className="text-xs text-white/60">Staff and security have been notified. Help is on the way.</p>
                <div className="text-left text-xs space-y-1 pt-2 border-t border-white/10">
                  <p>🚨 Emergency: {hotlines?.emergencyDisplay ?? config?.emergencyDisplay}</p>
                  <p>🛡️ Security: {hotlines?.securityLine ?? config?.securityLine}</p>
                  <p>👤 Manager: {hotlines?.managerLine ?? config?.managerLine}</p>
                </div>
              </div>
            )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}
