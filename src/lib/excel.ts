import * as XLSX from "xlsx";

export type Sheet = (string | number | null)[][];

export function exportSheets(filename: string, sheets: Record<string, Sheet>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // freeze first row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    // estimate column widths
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const widths: { wch: number }[] = [];
    for (let c = 0; c < maxCols; c++) {
      let w = 10;
      for (const r of rows) {
        const v = r[c];
        if (v != null) w = Math.max(w, String(v).length + 2);
      }
      widths.push({ wch: Math.min(w, 60) });
    }
    ws["!cols"] = widths;
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

export const fmt = {
  money: (n: number) => Number((n || 0).toFixed(2)),
  date: (iso?: string | number) => {
    if (!iso) return "";
    const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
    return d.toISOString().slice(0, 10);
  },
};
