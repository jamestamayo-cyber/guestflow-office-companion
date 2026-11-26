import { format } from "date-fns";
import { fmtDuration } from "@/lib/ovms/format";
import type { Visitor } from "@/lib/ovms/types";

export const reportHeaders = ["Record ID", "Visitor", "Purpose", "Host", "Time-in", "Time-out", "Duration"];
export function reportRows(visitors: Visitor[]) {
  return visitors.map((v) => [v.id, v.fullName, v.purpose, v.host, format(new Date(v.timeIn), "yyyy-MM-dd HH:mm:ss"), v.timeOut ? format(new Date(v.timeOut), "yyyy-MM-dd HH:mm:ss") : "Still inside", fmtDuration(v.timeIn, v.timeOut)]);
}
export function createCsv(visitors: Visitor[]) {
  const quote = (value: string) => `"${(/^[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  return "\uFEFF" + [reportHeaders, ...reportRows(visitors)].map((row) => row.map(quote).join(",")).join("\r\n");
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function createPdf(visitors: Visitor[], label: string): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(17); doc.text("Administrative Services Office", 14, 16);
  doc.setFontSize(11); doc.text(label.replace(/–/g, "-"), 14, 24);
  doc.setFontSize(9); doc.text(`${visitors.length} visits | Times in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, 14, 31);
  autoTable(doc, { startY: 37, head: [reportHeaders], body: reportRows(visitors), styles: { fontSize: 8, cellPadding: 3 }, theme: "grid", didDrawPage: () => { doc.setFontSize(8); doc.text(`Visitor report | Page ${doc.getNumberOfPages()}`, 14, 200); } });
  return doc.output("blob");
}
