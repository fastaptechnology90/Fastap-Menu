import { useEffect, useState } from "react";
import { publicApi } from "@/lib/api";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useGuestBack } from "@/hooks/useGuestBack";
import { Sparkles, Rocket, Bell } from "lucide-react";

type FutureFeature = {
  id: string; label: string; icon: string; status: string; desc: string; eta: string;
};

const STATUS_COLORS: Record<string, string> = {
  beta: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  coming_soon: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  research: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function FutureAIPage() {
  const goBack = useGuestBack();
  const [features, setFeatures] = useState<FutureFeature[]>([]);
  const [waitlistFeature, setWaitlistFeature] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    publicApi.aiFuture.catalog().then(r => setFeatures((r.features ?? []) as FutureFeature[])).catch(() => {});
  }, []);

  async function joinWaitlist(featureId: string) {
    if (!email) { setMsg("Enter your email"); return; }
    try {
      const r = await publicApi.aiFuture.waitlist({ featureId, email });
      setMsg(r.message);
      setWaitlistFeature(null);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed to join waitlist");
    }
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header px-4 py-4 flex items-center gap-3">
        <GuestBackButton onClick={goBack} />
        <div>
          <h1 className="font-display text-lg font-bold">Future AI Roadmap</h1>
          <p className="text-xs text-white/40">Next-generation hospitality AI</p>
        </div>
      </div>

      <div className="px-4">
        <div className="guest-card p-4 mb-6 bg-gradient-to-br from-violet-500/10 to-orange-500/10 border-violet-500/20">
          <div className="flex items-center gap-3">
            <Rocket className="h-8 w-8 text-violet-400" />
            <div>
              <p className="font-semibold">AI Future Roadmap</p>
              <p className="text-xs text-white/50 mt-0.5">Voice ordering, virtual waiter, mood detection & more</p>
            </div>
          </div>
        </div>

        {msg && <p className="text-sm text-emerald-400 mb-4 text-center">{msg}</p>}

        <div className="space-y-3">
          {features.map(f => (
            <div key={f.id} className="guest-card p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{f.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{f.label}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[f.status] ?? STATUS_COLORS.coming_soon}`}>
                      {f.status.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-white/30">{f.eta}</span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">{f.desc}</p>
                  <button
                    onClick={() => setWaitlistFeature(f.id)}
                    className="mt-2 text-xs text-violet-400 flex items-center gap-1 hover:text-violet-300"
                  >
                    <Bell className="h-3 w-3" /> Notify me when live
                  </button>
                </div>
              </div>
              {waitlistFeature === f.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                    placeholder="your@email.com"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                  <button onClick={() => joinWaitlist(f.id)} className="px-4 py-2 rounded-lg bg-violet-500 text-sm font-semibold">Join</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-white/30 flex items-center justify-center gap-1">
          <Sparkles className="h-3 w-3" /> Powered by FastAP AI Labs
        </div>
      </div>
    </div>
  );
}
