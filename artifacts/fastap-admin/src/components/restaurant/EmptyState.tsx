import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="text-center py-12 px-4">
      <Inbox className="h-10 w-10 text-white/20 mx-auto mb-3" />
      <p className="text-sm font-semibold text-white/40">{title}</p>
      {description && <p className="text-xs text-white/25 mt-1 max-w-sm mx-auto">{description}</p>}
    </div>
  );
}
