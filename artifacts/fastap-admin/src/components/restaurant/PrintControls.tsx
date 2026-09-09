import { useEffect, useState } from "react";
import { Printer, ChefHat, Receipt } from "lucide-react";

import { printing, openPrintWindow, type PrintRecord } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

/**
 * The two pieces of paper a restaurant runs on: the kitchen ticket that goes to the pass
 * and the bill that goes to the table. Neither could be produced from this product at
 * all, so every venue was writing dockets by hand next to a screen that already knew
 * what was ordered.
 *
 * A first print and a reprint are deliberately different actions. Pressing "Bill" twice
 * still records two copies, and the second one is stamped DUPLICATE — a second copy of a
 * bill is how a table gets charged twice or a settled sale walks out of the till, so the
 * paper itself has to say which copy it is.
 */

export function PrintControls({
  restaurantId,
  orderId,
  className = "",
  showHistory = true,
}: {
  restaurantId: number | null;
  orderId: number | null;
  className?: string;
  showHistory?: boolean;
}) {
  const [busy, setBusy] = useState<"kot" | "bill" | null>(null);
  const [prints, setPrints] = useState<PrintRecord[]>([]);

  useEffect(() => {
    if (!restaurantId || !orderId || !showHistory) { setPrints([]); return; }
    let live = true;
    printing.log(restaurantId, orderId)
      .then(r => { if (live) setPrints(r.prints ?? []); })
      .catch(() => { if (live) setPrints([]); });
    return () => { live = false; };
  }, [restaurantId, orderId, showHistory]);

  if (!restaurantId || !orderId) return null;

  async function run(kind: "kot" | "bill") {
    if (!restaurantId || !orderId) return;
    setBusy(kind);
    try {
      const r = await printing.reprint(restaurantId, orderId, kind);
      const opened = openPrintWindow(
        r.html,
        kind === "kot" ? printing.kotUrl(restaurantId, orderId) : printing.billUrl(restaurantId, orderId),
      );
      setPrints(p => [...p, { kind, copy: r.copy, by: r.by, at: r.at }]);
      if (!opened) {
        toast({
          title: "Your browser blocked the print window",
          description: "Allow pop-ups for this site, or the document will open in this tab instead.",
        });
      } else if (r.copy > 1) {
        toast({
          title: kind === "kot" ? `Kitchen ticket — reprint #${r.copy}` : `Bill — duplicate copy #${r.copy}`,
          description: "The copy number is printed on the document.",
        });
      }
    } catch (e) {
      // A print that fails silently is worse than no button: the cashier stands there
      // waiting for paper that is never coming.
      toast({
        title: kind === "kot" ? "Could not print the kitchen ticket" : "Could not print the bill",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  const billCopies = prints.filter(p => p.kind === "bill").length;
  const kotCopies = prints.filter(p => p.kind === "kot").length;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run("kot")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-semibold text-foreground hover-elevate disabled:opacity-40"
        >
          <ChefHat className="h-3.5 w-3.5" />
          {busy === "kot" ? "Printing…" : kotCopies > 0 ? `Reprint KOT (${kotCopies})` : "Print KOT"}
        </button>
        <button
          onClick={() => run("bill")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/25 disabled:opacity-40"
        >
          <Receipt className="h-3.5 w-3.5" />
          {busy === "bill" ? "Printing…" : billCopies > 0 ? `Duplicate bill (${billCopies})` : "Print bill"}
        </button>
      </div>

      {showHistory && prints.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {prints.slice(-4).map((p, i) => (
            <p key={`${p.at}-${i}`} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Printer className="h-3 w-3" />
              {p.kind === "kot" ? "Kitchen ticket" : "Bill"} copy {p.copy} · {p.by} · {new Date(p.at).toLocaleTimeString("en-IN")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
