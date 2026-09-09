import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType = "success" | "warning" | "error" | "info" | "default";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
  type?: StatusType;
}

/**
 * Keyword matching, longest and most specific first.
 *
 * Order matters and it did not used to: "pending" was checked before "failed",
 * so "payment pending failure" came out amber, and "approved" was checked before
 * "not approved". Substring matching cannot fully solve that, but the word
 * boundaries below stop the worst of it — `high` no longer matches `highlighted`.
 */
const RULES: ReadonlyArray<readonly [StatusType, RegExp]> = [
  ["error", /\b(failed|failure|suspended|rejected|cancell?ed|declined|error|overdue|critical|high)\b/],
  ["success", /\b(active|success|successful|completed|complete|resolved|approved|paid|delivered|served|confirmed|open)\b/],
  ["warning", /\b(pending|trial|review|awaiting|hold|on.hold|partial|medium|expiring)\b/],
  ["info", /\b(processing|requested|scheduled|queued|draft|new|low|in.progress)\b/],
];

function inferType(status: string): StatusType {
  const text = status.toLowerCase();
  for (const [type, pattern] of RULES) {
    if (pattern.test(text)) return type;
  }
  return "default";
}

const VARIANT: Record<StatusType, "success" | "warning" | "danger" | "info" | "muted"> = {
  success: "success",
  warning: "warning",
  error: "danger",
  info: "info",
  default: "muted",
};

/**
 * A status chip that derives its colour from the word it shows.
 *
 * It used to hardcode `bg-green-500/10 text-green-500 border-green-500/20` and
 * three siblings, which meant status colour did not follow the theme and read
 * differently on the dark panels than on the light admin. The colour now comes
 * from the semantic Badge variants, so `--success` and friends are the single
 * place any of it changes.
 */
export function StatusBadge({ status, type = "default", className, ...props }: StatusBadgeProps) {
  const resolved = type === "default" ? inferType(status) : type;

  return (
    <Badge variant={VARIANT[resolved]} className={cn("capitalize", className)} {...props}>
      {status}
    </Badge>
  );
}
