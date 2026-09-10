/**
 * The public wordmark.
 *
 * Drawn rather than loaded: it costs no request, prints correctly, and needs no
 * second asset for a dark ground — the square takes the red and the glyph takes
 * whatever `currentColor` is on the text beside it.
 *
 * The glyph is a tap — a screen with a ripple spreading from the point of
 * contact — rather than the crossed cutlery every restaurant tool already uses.
 * It says what the product is: a guest taps a code on a table, an order appears
 * in a kitchen.
 */

/** A fingertip on a screen, and the ripple it leaves. */
export function TapGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The screen, open at the bottom right where the hand comes in. */}
      <path d="M5.5 15.5V6.2A1.7 1.7 0 0 1 7.2 4.5h9.6A1.7 1.7 0 0 1 18.5 6.2v4.1" />
      {/* The ripple. */}
      <path d="M9.4 8.6a3.7 3.7 0 0 1 5.2 0" opacity="0.55" />
      {/* The finger, tapping. */}
      <path d="M12 10.4v5.1l-1.6-1.1a1.5 1.5 0 0 0-2 2.2l3.2 3.1a4 4 0 0 0 2.8 1.1h1.9a3.3 3.3 0 0 0 3.3-3.3v-3a1.4 1.4 0 0 0-2.8 0 1.4 1.4 0 0 0-2.8 0V10.4a1.5 1.5 0 0 0-3 0Z" />
    </svg>
  );
}

export function SiteBrand({
  size = "md",
  onDark = false,
}: {
  size?: "md" | "lg";
  /** Inverts the wordmark for the hero and the sign-in artwork panel. */
  onDark?: boolean;
}) {
  const box = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const glyph = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const word = size === "lg" ? "text-2xl" : "text-xl";

  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`${box} inline-flex items-center justify-center rounded-xl bg-primary text-white`}>
        <TapGlyph className={glyph} />
      </span>
      <span className={`fs-display ${word} ${onDark ? "text-white" : "text-foreground"}`}>
        Fastap<span className={onDark ? "text-white/60" : "text-muted-foreground"}> OS</span>
      </span>
    </span>
  );
}
