import { useState, useEffect } from "react";
import { Megaphone, Send, MessageSquare, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";

export default function CommunicationsCenter() {
  const { restaurantId } = useRestaurant();
  const [history, setHistory] = useState<any[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", message: "", channel: "internal", target: "all-staff" });
  const [sending, setSending] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    platformApi.communications(restaurantId).then(d => {
      setHistory(Array.isArray(d.history) ? d.history : []);
      setChannels(d.channels || ["push", "email", "sms", "whatsapp", "internal"]);
    }).catch(() => {});
  };

  useEffect(load, [restaurantId]);

  async function sendBroadcast() {
    if (!restaurantId || !form.title.trim() || !form.message.trim()) return;
    setSending(true);
    await platformApi.broadcast(restaurantId, form).catch(() => {});
    setForm({ title: "", message: "", channel: "internal", target: "all-staff" });
    load();
    setSending(false);
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">Communication Center</h1>
        <p className="text-xs text-white/40">Broadcasts, maintenance alerts & renewal reminders</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-amber-400" /> New Broadcast</h3>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Subject / title"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm"
          />
          <textarea
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            rows={4}
            placeholder="Message body…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
              {channels.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
              {["all-staff", "managers", "kitchen", "waiters", "maintenance"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={sendBroadcast} disabled={sending} className="w-full py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {sending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Broadcast
          </button>
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
          <h3 className="font-bold flex items-center gap-2 mb-4"><MessageSquare className="h-4 w-4 text-violet-400" /> History</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.length === 0 && <p className="text-sm text-white/40">No broadcasts yet — send your first message.</p>}
            {history.map(h => (
              <div key={h.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold">{h.subject}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{h.channel}</span>
                </div>
                <p className="text-xs text-white/50">{h.message}</p>
                <p className="text-xs text-white/30 mt-1">{h.recipients} recipients · {h.sentAt ? new Date(h.sentAt).toLocaleString() : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
