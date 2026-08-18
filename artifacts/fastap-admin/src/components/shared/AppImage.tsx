import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { menuFallbackImage } from "@/lib/media";

type AppImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackId?: string | number;
  category?: string;
  iconFallback?: string;
  aspect?: "square" | "video" | "wide";
};

const aspectClass = {
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[16/10]",
};

export function AppImage({
  src,
  alt,
  className,
  fallbackId = alt,
  category,
  iconFallback = "restaurant",
  aspect = "square",
}: AppImageProps) {
  const [error, setError] = useState(false);
  const resolved = !src || error ? menuFallbackImage(fallbackId, category) : src;

  return (
    <div className={cn("relative overflow-hidden bg-white/5", aspectClass[aspect], className)}>
      <img
        src={resolved}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setError(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {(!src || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-violet-500/10">
          <Icon name={iconFallback} size={28} className="text-white/25" />
        </div>
      )}
    </div>
  );
}
