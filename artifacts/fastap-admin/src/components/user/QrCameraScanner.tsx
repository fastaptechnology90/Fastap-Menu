import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

type Props = {
  onScan: (url: string) => void;
  onClose: () => void;
};

function extractUrl(raw: string): string | null {
  const text = raw.trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/scan/") || text.startsWith("/e/") || text.startsWith("/user/")) {
    return `${window.location.origin}${text.startsWith("/") ? text : `/${text}`}`;
  }
  const match = text.match(/(?:scan|e)\/[a-z0-9-]+[^\s]*/i);
  if (match) return `${window.location.origin}/${match[0]}`;
  return null;
}

export function QrCameraScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (!Detector) {
          setError("Camera open — point at table/room QR. Your browser will open the link automatically when you scan from the camera app.");
          return;
        }

        const detector = new Detector({ formats: ["qr_code"] });
        const tick = async () => {
          if (!videoRef.current || handled.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            for (const code of codes) {
              const url = code.rawValue ? extractUrl(code.rawValue) : null;
              if (url) {
                handled.current = true;
                onScan(url);
                return;
              }
            }
          } catch { /* frame not ready */ }
          timer = window.setTimeout(tick, 350);
        };
        tick();
      } catch {
        setError("Camera permission denied. Open your phone camera app and scan the table or room QR code instead.");
      }
    }

    start();

    return () => {
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold text-white">Scan table or room QR</p>
        <button onClick={onClose} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 gap-4">
        <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden border-2 border-orange-500/50">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-8 border-2 border-white/40 rounded-xl pointer-events-none" />
        </div>
        <p className="text-xs text-white/50 text-center max-w-sm flex items-center gap-2 justify-center">
          <Camera className="h-4 w-4 shrink-0" />
          {error ?? "Align the QR code inside the frame"}
        </p>
      </div>
    </div>
  );
}
