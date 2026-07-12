/**
 * Downloads an array of objects as a CSV file.
 * Excludes keys listed in `excludeKeys`. Column headers are auto-generated from keys.
 */
export function downloadCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  excludeKeys: string[] = []
) {
  if (!data.length) return;

  const keys = Object.keys(data[0]).filter((k) => !excludeKeys.includes(k));

  const header = keys.map(humanizeKey).join(",");
  const rows = data.map((row) =>
    keys
      .map((k) => {
        const val = row[k];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Wrap in quotes if contains comma, newline or quote
        return str.includes(",") || str.includes("\n") || str.includes('"')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
