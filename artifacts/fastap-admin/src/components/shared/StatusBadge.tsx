import { type VariantProps } from "class-variance-authority";
import { Badge } from "@/components/ui/badge";

export type StatusType = "success" | "warning" | "error" | "info" | "default";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
  type?: StatusType;
}

export function StatusBadge({ status, type = "default", className, ...props }: StatusBadgeProps) {
  let badgeType: StatusType = type;
  
  if (type === "default") {
    const lower = status.toLowerCase();
    if (lower.includes("active") || lower.includes("success") || lower.includes("completed") || lower.includes("resolved") || lower.includes("approved")) {
      badgeType = "success";
    } else if (lower.includes("pending") || lower.includes("trial") || lower.includes("review") || lower.includes("medium")) {
      badgeType = "warning";
    } else if (lower.includes("failed") || lower.includes("suspended") || lower.includes("rejected") || lower.includes("high") || lower.includes("critical") || lower.includes("error")) {
      badgeType = "error";
    } else if (lower.includes("processing") || lower.includes("requested") || lower.includes("low")) {
      badgeType = "info";
    }
  }

  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let customClass = "";

  switch (badgeType) {
    case "success":
      customClass = "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20";
      variant = "outline";
      break;
    case "warning":
      customClass = "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20";
      variant = "outline";
      break;
    case "error":
      customClass = "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20";
      variant = "outline";
      break;
    case "info":
      customClass = "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20";
      variant = "outline";
      break;
    default:
      variant = "secondary";
  }

  return (
    <Badge variant={variant} className={`${customClass} ${className}`} {...props}>
      {status}
    </Badge>
  );
}