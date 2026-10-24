/** Downloads stay on the operator's machine; imported reports are never uploaded. */
export function downloadText(filename: string, content: string, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([content], {type:mime}));
  const link = document.createElement("a"); link.href=url; link.download=filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csv(rows: (string | number | null)[][]): string {
  return rows.map(row=>row.map(value=>{
    const text=String(value ?? "");
    // Treat labels as text in spreadsheet clients, including formula-like names.
    const safe=typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"','""')}"`;
  }).join(",")).join("\r\n");
}
