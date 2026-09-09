import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-12 px-4">
      <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>}
    </div>
  );
}
