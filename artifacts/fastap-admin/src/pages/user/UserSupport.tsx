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
  CheckCircle, AlertCircle, Headphones, Clock, ExternalLink, Mic, Shield, Loader,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

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
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live chat
  const [sessionId, setSessionId] = useState<string | null>(null);
  // The chat is automated. It used to open as a named person ("I'm Priya from
  // support"), which left a guest waiting on someone who does not exist.
  const [agentName, setAgentName] = useState("Support assistant");
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

  // One green tick banner was used for confirmations AND for failures, so "Permission
  // denied", "Sync failed" and "Image too large" all read as good news. `ok: false`
  // paints the same banner as a problem.
  function showToast(msg: string, ok = true) {
    setToast({ text: msg, ok });
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
    if (!voicePhone.trim()) { showToast("Enter your phone number so we can call you back", false); return; }
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
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Help &amp; requests</p>
            <h1 className="text-base font-semibold flex items-center gap-2">
              <Headphones className="h-4 w-4 text-info" /> Guest Support
            </h1>
          </div>
          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {/* This said "2 online" whether or not anyone was. Chat is automated; the
                channels that reach a person are listed below. */}
            Automated assistant
          </div>
        </div>

        {toast && (
          <div
            role={toast.ok ? undefined : "alert"}
            className={`mx-4 mb-2 rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${toast.ok ? "border-success-border bg-success-subtle text-success" : "border-danger-border bg-danger-subtle text-danger"}`}
          >
            {toast.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {toast.text}
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
                      ? "bg-danger-subtle border border-danger-border text-danger"
                      : "bg-info-subtle border border-info-border text-info"
                    : "bg-muted border border-border text-muted-foreground"
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
                tab === c.id ? "border-info-border bg-info-subtle" : "border-border bg-muted"
              }`}>
              <GuestIcon id={c.id} className="h-4 w-4 text-primary" />
              <p className="text-xs font-semibold mt-1">{c.label}</p>
              <p className="text-2xs text-muted-foreground line-clamp-2">{c.desc}</p>
              {c.avgWait ? <p className="text-2xs text-info mt-1 flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {c.avgWait}</p> : null}
            </button>
          ))}
        </div>

        {config?.hours ? <p className="text-xs text-muted-foreground text-center">{config.hours}</p> : null}

        {/* Live Chat */}
        {tab === "live_chat" && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col" style={{ height: "420px" }}>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <p className="text-sm font-semibold">{agentName} · Live Chat</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === "guest" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "guest" ? "bg-info-subtle border border-info-border" : "bg-muted border border-border"
                  }`}>
                    {m.role === "agent" && <p className="text-2xs text-muted-foreground mb-0.5">{m.name}</p>}
                    {m.message}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="px-3 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
              {CHAT_QUICK_REPLIES.map(q => (
                <button key={q} onClick={() => sendChat(q)} className="shrink-0 text-2xs px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                  {q}
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-border flex gap-2">
              <input
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-info-border"
                placeholder="Type a message…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
              />
              <button onClick={() => sendChat()} className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* WhatsApp */}
        {tab === "whatsapp" && (
          <>
            <div className="rounded-xl bg-success-subtle border border-success-border p-4">
              <p className="text-sm font-semibold text-success">
                {config?.whatsappDisplay ? `WhatsApp: ${config.whatsappDisplay}` : "This restaurant has not set up a WhatsApp line"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Send photos, receipts, or voice notes directly to our support team.</p>
            </div>
            <textarea
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-success-border"
              value={waMessage}
              onChange={e => setWaMessage(e.target.value)}
              placeholder="Your message to support…"
            />
            <button onClick={openWhatsApp} disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Open WhatsApp Chat
            </button>
          </>
        )}

        {/* Voice Support */}
        {tab === "voice" && (
          <>
            <div className="rounded-xl bg-info-subtle border border-info-border p-4 text-center">
              <Phone className="h-8 w-8 text-info mx-auto mb-2" />
              <p className="text-lg font-semibold text-info">
                {config?.voiceHelplineDisplay || config?.voiceHelpline || "No helpline number on file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Call directly or request a callback below</p>
              <a href={`tel:${config?.voiceHelpline ?? ""}`} className="inline-block mt-3 px-4 py-2 rounded-xl bg-info-subtle border border-info-border text-info text-sm font-semibold">
                Call Now
              </a>
            </div>
            <p className="text-sm font-semibold">Request Callback</p>
            <input
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm"
              placeholder="Your phone number"
              value={voicePhone}
              onChange={e => setVoicePhone(e.target.value)}
            />
            <select
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm"
              value={voiceSlot}
              onChange={e => setVoiceSlot(e.target.value)}
            >
              {VOICE_CALLBACK_SLOTS.map(s => <option key={s} value={s} className="bg-muted">{s}</option>)}
            </select>
            <textarea
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm min-h-[80px]"
              placeholder="Brief reason for call (optional)"
              value={voiceReason}
              onChange={e => setVoiceReason(e.target.value)}
            />
            <button onClick={requestVoiceCallback} disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
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
                    ticketCategory === c.id ? "bg-info-subtle border-info-border text-info" : "border-border text-muted-foreground"
                  }`}>
                  <><GuestIcon id={c.id} className="h-3.5 w-3.5" /> {c.label}</>
                </button>
              ))}
            </div>
            <input
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm"
              placeholder="Subject (optional)"
              value={ticketSubject}
              onChange={e => setTicketSubject(e.target.value)}
            />
            <textarea
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm min-h-[100px]"
              placeholder="Describe your issue in detail…"
              value={ticketMessage}
              onChange={e => setTicketMessage(e.target.value)}
            />
            <button onClick={submitTicket} disabled={submitting || !ticketMessage.trim()}
              className="w-full py-3.5 rounded-xl bg-primary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Ticket className="h-4 w-4" /> Submit Ticket
            </button>

            {myTickets.length > 0 && (
              <div className="rounded-xl bg-muted border border-border p-4">
                <p className="text-sm font-semibold mb-3">My Tickets</p>
                <div className="space-y-2">
                  {myTickets.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs border-b border-border pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{t.ticketNumber ?? `TKT-${t.id}`}</p>
                        <p className="text-muted-foreground truncate max-w-[200px]">{t.subject}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full capitalize ${
                        t.status === "open" ? "bg-warning-subtle text-warning"
                          : t.status === "in_progress" ? "bg-info-subtle text-info"
                            : "bg-success-subtle text-success"
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
            <div className="rounded-xl bg-danger-subtle border border-danger-border p-4">
              {/* This printed a placeholder number as a 24/7 emergency line and offered
                  to dial it. A venue that has not set one up must not appear to have one. */}
              {config?.emergencyHotline ? (
                <>
                  <p className="text-sm font-semibold text-danger flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Emergency line: {config.emergencyDisplay || config.emergencyHotline}
                  </p>
                  <a href={`tel:${config.emergencyHotline}`} className="block mt-2 text-center py-3 rounded-md bg-destructive text-destructive-foreground font-semibold text-sm">
                    CALL THIS RESTAURANT&apos;S EMERGENCY LINE
                  </a>
                </>
              ) : (
                <p className="text-sm font-semibold text-danger flex items-center gap-2">
                  <Shield className="h-4 w-4" /> In a real emergency, tell a member of staff and call your local emergency number.
                </p>
              )}
            </div>

            {!emergencySent ? (
              <>
                <p className="text-sm text-muted-foreground">Select emergency type and alert on-site staff immediately:</p>
                <div className="space-y-2">
                  {EMERGENCY_TYPES.map(e => (
                    <button key={e.id} onClick={() => setEmergencyType(e.id)}
                      className={`w-full text-left rounded-xl border p-3 ${
                        emergencyType === e.id ? "border-danger-border bg-danger-subtle" : "border-border bg-muted"
                      }`}>
                      <p className="font-semibold text-sm flex items-center gap-1.5"><GuestIcon id={e.id} className="h-4 w-4" /> {e.label}</p>
                      <p className="text-xs text-muted-foreground">{e.desc}</p>
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm min-h-[80px]"
                  placeholder="Additional details (location, table number, etc.)"
                  value={emergencyMessage}
                  onChange={e => setEmergencyMessage(e.target.value)}
                />
                <button onClick={sendEmergency} disabled={submitting}
                  className="w-full py-4 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <AlertTriangle className="h-5 w-5" /> SEND EMERGENCY ALERT
                </button>
              </>
            ) : (
              <div className="rounded-xl bg-danger-subtle border border-danger-border p-4 text-center space-y-3">
                <CheckCircle className="h-10 w-10 text-danger mx-auto" />
                <p className="font-semibold text-danger">Alert raised</p>
                {/* It used to say help was on the way. All that happens is a record
                    appearing in the restaurant's system; nobody is paged. */}
                <p className="text-xs text-muted-foreground">
                  This has been recorded for the restaurant&apos;s team. Do not wait on it —
                  tell a member of staff now, and call your local emergency number if
                  anyone is at risk.
                </p>
                {[
                  ["Emergency", hotlines?.emergencyDisplay || config?.emergencyDisplay],
                  ["Security", hotlines?.securityLine || config?.securityLine],
                  ["Manager", hotlines?.managerLine || config?.managerLine],
                ].filter(([, v]) => Boolean(v)).length > 0 && (
                  <div className="text-left text-xs space-y-1 pt-2 border-t border-border">
                    {[
                      ["Emergency", hotlines?.emergencyDisplay || config?.emergencyDisplay],
                      ["Security", hotlines?.securityLine || config?.securityLine],
                      ["Manager", hotlines?.managerLine || config?.managerLine],
                    ].filter(([, v]) => Boolean(v)).map(([label, v]) => <p key={label}>{label}: {v}</p>)}
                  </div>
                )}
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
