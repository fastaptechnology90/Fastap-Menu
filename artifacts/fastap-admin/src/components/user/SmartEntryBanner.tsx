import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { accessMethodLabel, serviceModeLabel } from "@/lib/smartEntry";
import { ChevronDown, ChevronUp, QrCode, Users, RefreshCw } from "lucide-react";

export function SmartEntryBanner() {
  const { smartEntry, joinShareSession, createFamilySession } = useUser();
  const [expanded, setExpanded] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [msg, setMsg] = useState("");

  if (!smartEntry) return null;

  const { detection, session, offline, areaGroups } = smartEntry;

  return (
    <div className="mb-3 rounded-xl border border-primary bg-muted overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <QrCode className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-primary truncate">
              {accessMethodLabel(detection.entryMethod)} · {serviceModeLabel(detection.serviceMode)}
              {offline && " (Demo)"}
            </div>
            <div className="text-2xs text-muted-foreground truncate">
              {detection.branchName || "Branch"} · {detection.language} · {detection.timezone}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-primary pt-3">
          {session?.shareCode && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Table share code</span>
              <span className="font-mono font-semibold text-primary">{session.shareCode}</span>
            </div>
          )}

          {areaGroups && areaGroups.length > 0 && (
            <div className="space-y-2">
              {areaGroups.map(g => (
                <div key={g.category}>
                  <div className="text-2xs uppercase tracking-wider text-muted-foreground mb-1">{g.label}</div>
                  <div className="flex flex-wrap gap-1">
                    {(g.areas ?? []).slice(0, 6).map((a: { id: number; name: string }) => (
                      <span key={a.id} className="px-1.5 py-0.5 rounded bg-muted text-2xs text-muted-foreground">{a.name}</span>
                    ))}
                    {(g.areas?.length ?? 0) > 6 && (
                      <span className="text-2xs text-muted-foreground">+{(g.areas?.length ?? 0) - 6} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {Object.entries(session?.features ?? {}).filter(([, v]) => v).map(([k]) => (
              <span key={k} className="px-2 py-0.5 rounded-full bg-success-subtle text-success text-2xs border border-success-border">
                {k.replace(/([A-Z])/g, " $1").trim()}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={shareCode}
              onChange={e => setShareCode(e.target.value.toUpperCase())}
              placeholder="Join share code"
              className="flex-1 bg-muted border border-border rounded-lg px-2 py-1.5 text-xs"
            />
            <button
              onClick={async () => {
                try { await joinShareSession(shareCode); setMsg("Joined!"); } catch { setMsg("Invalid code"); }
              }}
              className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium hover:bg-muted"
            >
              Join
            </button>
            <button
              onClick={async () => {
                try {
                  const r = await createFamilySession();
                  setMsg(`Family code: ${r.shareCode}`);
                } catch { setMsg("Failed"); }
              }}
              className="px-2 py-1.5 rounded-lg bg-muted text-xs hover:bg-muted"
              title="Family session"
            >
              <Users className="h-3.5 w-3.5" />
            </button>
          </div>
          {msg && <p className="text-2xs text-primary">{msg}</p>}
          <div className="flex items-center gap-1 text-2xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" /> Auto-reconnect & session restore active
          </div>
        </div>
      )}
    </div>
  );
}
