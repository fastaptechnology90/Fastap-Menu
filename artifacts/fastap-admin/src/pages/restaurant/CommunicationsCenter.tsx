import { useState, useEffect } from "react";
import { Megaphone, Send, MessageSquare, Loader } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { platformApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";

export default function CommunicationsCenter() {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [history, setHistory] = useState<any[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", message: "", channel: "internal", target: "all-staff" });
  const [sending, setSending] = useState(false);

  const load = () => {
    if (!restaurantId) return;
    platformApi.communications(restaurantId).then(d => {
      setHistory(Array.isArray(d.history) ? d.history : []);
      // The API advertises push / email / sms / whatsapp, but the broadcast route
      // only writes the message into this venue's own record — there is no email,
      // SMS or WhatsApp transport in the server. Offering those channels tells an
      // owner announcing "closed tomorrow" that twelve staff were messaged when
      // nobody was. Until a transport exists, only offer the one that is real.
      const supported = (d.channels || []).filter((c: string) => c === "internal");
      setChannels(supported.length ? supported : ["internal"]);
    }).catch((e: any) => {
      toast({ variant: "destructive", title: "Could not load communications", description: e?.message || "Failed to load broadcast history." });
    });
  };

  useEffect(load, [restaurantId]);

  async function sendBroadcast() {
    if (!restaurantId || !form.title.trim() || !form.message.trim()) return;
    setSending(true);
    try {
      await platformApi.broadcast(restaurantId, form);
      setForm({ title: "", message: "", channel: "internal", target: "all-staff" });
      load();
      toast({
        title: "Notice posted",
        description: "It appears in the history beside this form. Nothing was emailed or texted — this venue has no message transport connected yet.",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Broadcast failed", description: e?.message || "Could not send the broadcast." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="border-b pb-4">
        <h1 className="text-xl font-semibold">Communication Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Notices posted to this venue's record</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-lg bg-card border border-border p-5 space-y-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" /> New notice</h3>
            <p className="mt-1 text-xs text-muted-foreground">Posted to this venue's record. Email, SMS and WhatsApp delivery are not connected yet.</p>
          </div>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Subject / title"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm"
          />
          <textarea
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            rows={4}
            placeholder="Message body…"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm">
              {channels.map(c => <option key={c} value={c}>{c === "internal" ? "Internal notice" : c}</option>)}
            </select>
            <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm">
              {["all-staff", "managers", "kitchen", "waiters", "maintenance"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button onClick={sendBroadcast} disabled={sending} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {sending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post notice
          </button>
        </div>

        <div className="rounded-lg bg-card border border-border p-5">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><MessageSquare className="h-4 w-4 text-muted-foreground" /> History</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.length === 0 && <EmptyState title="No notices yet" description="Anything you post here is kept with the venue record." />}
            {history.map(h => (
              <div key={h.id} className="p-3 rounded-lg bg-muted border border-border">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold">{h.subject}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{h.channel}</span>
                </div>
                <p className="text-xs text-muted-foreground">{h.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{String(h.target || "all staff").replace(/-/g, " ")}{h.sentAt ? ` · ${new Date(h.sentAt).toLocaleString()}` : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
