const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export async function downloadFromApi(path: string, filename: string) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  triggerDownload(blob, filename);
}

export function downloadText(content: string, filename: string, mime = "text/plain;charset=utf-8") {
  triggerDownload(new Blob([content], { type: mime }), filename);
}

export function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) {
    downloadText("", filename.replace(/\.csv$/i, "") + ".csv", "text/csv;charset=utf-8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(row => headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  downloadText(lines.join("\n"), filename.endsWith(".csv") ? filename : `${filename}.csv`, "text/csv;charset=utf-8");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
