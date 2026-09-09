import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useGuestBack } from "@/hooks/useGuestBack";
import { Sparkles, Rocket, Bell } from "lucide-react";

type FutureFeature = {
  id: string; label: string; icon: string; status: string; desc: string; eta: string;
};

const STATUS_COLORS: Record<string, string> = {
  beta: "bg-success-subtle text-success border-success-border",
  coming_soon: "bg-muted text-primary border-primary",
  research: "bg-warning-subtle text-warning border-warning-border",
};

export default function FutureAIPage() {
  const goBack = useGuestBack();
  const [features, setFeatures] = useState<FutureFeature[]>([]);
  const [waitlistFeature, setWaitlistFeature] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  // Failures were rendered in the same green success line as confirmations, so "Could
  // not load" and "Enter your email" both read as good news.
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    publicApi.aiFuture.catalog().then(r => setFeatures((r.features ?? []) as FutureFeature[]))
      .catch(() => setMsg({ text: "Could not load what is coming next. Please try again later.", ok: false }));
  }, []);

  async function joinWaitlist(featureId: string) {
    if (!email) { setMsg({ text: "Enter your email so we can tell you when it is ready.", ok: false }); return; }
    if (joining) return;
    setJoining(featureId);
    try {
      const r = await publicApi.aiFuture.waitlist({ featureId, email });
      setMsg({ text: r.message, ok: true });
      setWaitlistFeature(null);
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Could not add you to the list. Please try again.", ok: false });
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-24">
      <div className="guest-header px-4 py-4 flex items-center gap-3">
        <GuestBackButton onClick={goBack} />
        <div>
          <h1 className="font-display text-lg font-semibold">Future AI Roadmap</h1>
          <p className="text-xs text-muted-foreground">Next-generation hospitality AI</p>
        </div>
      </div>

      <div className="px-4">
        <div className="guest-card p-4 mb-6 border-primary">
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">AI Future Roadmap</p>
              <p className="text-xs text-muted-foreground mt-0.5">Voice ordering, virtual waiter, mood detection & more</p>
            </div>
          </div>
        </div>

        {msg && (
          <p role={msg.ok ? undefined : "alert"} className={`text-sm mb-4 text-center ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>
        )}

        <div className="space-y-3">
          {features.map(f => (
            <div key={f.id} className="guest-card p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{f.label}</h3>
                    <span className={`text-2xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[f.status] ?? STATUS_COLORS.coming_soon}`}>
                      {f.status.replace("_", " ")}
                    </span>
                    <span className="text-2xs text-muted-foreground">{f.eta}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                  <button
                    onClick={() => setWaitlistFeature(f.id)}
                    className="mt-2 text-xs text-primary flex items-center gap-1 hover:text-primary"
                  >
                    <Bell className="h-3 w-3" /> Notify me when live
                  </button>
                </div>
              </div>
              {waitlistFeature === f.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm"
                    placeholder="your@email.com"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                  <button
                    onClick={() => joinWaitlist(f.id)}
                    disabled={joining === f.id}
                    className="px-4 py-2 rounded-lg bg-primary text-sm font-semibold disabled:opacity-50"
                  >
                    {joining === f.id ? "Adding…" : "Join"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Sparkles className="h-3 w-3" /> Powered by FastAP AI Labs
        </div>
      </div>
    </div>
  );
}
