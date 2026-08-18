import { useRef, useState, useCallback } from "react";
import { RotateCw } from "lucide-react";

type Props = { src: string; alt: string };

export function Preview360Viewer({ src, alt }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startRot = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startRot.current = rotation;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [rotation]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    setRotation(startRot.current + delta * 0.5);
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-75"
        style={{ transform: `perspective(800px) rotateY(${rotation}deg) scale(1.05)` }}
        draggable={false}
      />
      <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 text-xs text-white/80">
          <RotateCw className="h-3 w-3" /> Drag to rotate 360°
        </span>
      </div>
    </div>
  );
}
