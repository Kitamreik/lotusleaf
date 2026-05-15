// Shared PDF helpers — kept browser-only because jsPDF needs `window`.
// Used by /app/readiness and any other module that wants a printable export.
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

export type PdfSection = {
  heading: string;
  // Either a paragraph (rendered as wrapped text) OR a table (rendered via
  // autoTable). One of the two must be set.
  paragraph?: string;
  table?: { head: string[][]; body: RowInput[] };
};

export type PdfReportInput = {
  title: string;
  subtitle?: string;
  meta?: Array<[string, string]>;       // key/value pairs printed under subtitle
  sections: PdfSection[];
  footer?: string;                       // small print on every page
};

const GOLD: [number, number, number] = [180, 142, 56];
const INK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [110, 110, 110];

/** Build the PDF and trigger a download. */
export function downloadPdfReport(input: PdfReportInput, filename: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Title bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageWidth, 6, "F");
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(input.title, margin, y + 16);
  y += 28;

  if (input.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text(input.subtitle, margin, y);
    y += 16;
  }

  if (input.meta && input.meta.length) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    for (const [k, v] of input.meta) {
      doc.text(`${k}:  ${v}`, margin, y);
      y += 12;
    }
    y += 4;
  }

  // Gold rule under header
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  for (const section of input.sections) {
    if (y > pageHeight - margin - 80) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...GOLD);
    doc.text(section.heading, margin, y);
    y += 14;

    if (section.paragraph) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(section.paragraph, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 10;
    }

    if (section.table) {
      autoTable(doc, {
        head: section.table.head,
        body: section.table.body,
        startY: y,
        margin: { left: margin, right: margin },
        styles: { font: "helvetica", fontSize: 9, cellPadding: 4, textColor: INK },
        headStyles: { fillColor: GOLD, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 245, 235] },
        theme: "grid",
      });
      // jsPDF-autotable mutates lastAutoTable on the doc.
      const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      y = (last?.finalY ?? y) + 16;
    }
  }

  if (input.footer) {
    const pageCount = doc.getNumberOfPages();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(input.footer, margin, pageHeight - 24);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
    }
  }

  doc.save(filename);
}