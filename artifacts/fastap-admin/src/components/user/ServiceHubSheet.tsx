import { Icon } from "@/components/shared/Icon";
import { X } from "lucide-react";

export interface ServiceLink {
  label: string;
  path: string;
  icon: string;
}

const PRIMARY_COUNT = 5;

export function ServiceHubBar({
  links,
  onNavigate,
  onShowMore,
}: {
  links: ServiceLink[];
  onNavigate: (path: string) => void;
  onShowMore: () => void;
}) {
  const primary = links.slice(0, PRIMARY_COUNT);

  return (
    <div className="chip-scroll -mx-1 px-1 pb-1">
      {primary.map(link => (
        <button
          key={link.path}
          type="button"
          onClick={() => onNavigate(link.path)}
          className="service-chip"
        >
          <Icon name={link.icon} size={16} />
          {link.label}
        </button>
      ))}
      {links.length > PRIMARY_COUNT && (
        <button type="button" onClick={onShowMore} className="service-chip service-chip--more">
          <Icon name="apps" size={16} />
          More
        </button>
      )}
    </div>
  );
}

export function ServiceHubSheet({
  open,
  links,
  onClose,
  onNavigate,
}: {
  open: boolean;
  links: ServiceLink[];
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="guest-sheet-overlay" onClick={onClose}>
      <div className="guest-sheet" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-base">Explore services</h3>
          <button type="button" onClick={onClose} className="menu-icon-btn">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {links.map(link => (
            <button
              key={link.path}
              type="button"
              onClick={() => { onNavigate(link.path); onClose(); }}
              className="service-grid-item"
            >
              <span className="service-grid-item__icon">
                <Icon name={link.icon} size={22} />
              </span>
              <span className="text-[11px] font-medium text-white/80 leading-tight">{link.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
