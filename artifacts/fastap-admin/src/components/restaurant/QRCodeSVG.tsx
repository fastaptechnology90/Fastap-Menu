export function QRCodeSVG({ value, size = 120 }: { value: string; size?: number }) {
  const cells = 21;
  const cellSize = size / cells;
  const hash = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const pattern = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      if ((r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7)) return true;
      return (hash * (r + 1) * (c + 1) + r * c) % 3 === 0;
    }),
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" />
      {pattern.map((row, r) => row.map((on, c) => on ? (
        <rect key={`${r}-${c}`} x={c * cellSize} y={r * cellSize} width={cellSize} height={cellSize} fill="#1e1b4b" />
      ) : null))}
    </svg>
  );
}

export function downloadQrSvg(value: string, filename: string) {
  const cells = 21;
  const size = 200;
  const cellSize = size / cells;
  const hash = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rects: string[] = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const corner = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
      const on = corner || (hash * (r + 1) * (c + 1) + r * c) % 3 === 0;
      if (on) rects.push(`<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#1e1b4b"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/>${rects.join("")}</svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
