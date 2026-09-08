import type { ReactNode } from "react";
import { Construction } from "lucide-react";

export interface FeatureUnavailableProps {
  title: string;
  /** What the screen would do once it is real. */
  summary: string;
  /** Plain sentences saying what is missing. Keep them true. */
  details: string[];
  /** What the operator should do in the meantime. */
  workaround?: ReactNode;
}

/**
 * Stands in for a screen whose backend does not exist yet.
 *
 * These pages previously rendered fixtures indistinguishable from live data —
 * an owner reading "Last backup: yesterday, 24.5 MB" would believe their
 * restaurant was recoverable when nothing had ever been written. Showing
 * nothing is recoverable; showing a convincing lie is not.
 */
export default function FeatureUnavailable({ title, summary, details, workaround }: FeatureUnavailableProps) {
  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 lg:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Construction className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80">Not available yet</p>
            <h1 className="mt-1 text-xl font-extrabold">{title}</h1>
            <p className="mt-2 text-sm text-white/60">{summary}</p>
          </div>
        </div>

        <ul className="mt-6 space-y-2 border-t border-white/10 pt-5">
          {details.map(detail => (
            <li key={detail} className="flex gap-2.5 text-sm text-white/70">
              <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>

        {workaround && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
            {workaround}
          </div>
        )}
      </div>
    </div>
  );
}
