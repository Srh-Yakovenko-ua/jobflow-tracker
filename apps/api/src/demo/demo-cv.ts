export type DemoCvContent = { number: number; title: string };

const PDF_HEADER = '%PDF-1.7\n';

const pdfStringOf = (text: string) => text.replace(/[\\()]/g, '\\$&');

function pageObjectsOf({ number, title }: DemoCvContent): string[] {
  const line = pdfStringOf(`Demo candidate, ${title}, CV v${String(number)}`);
  const content = `BT /F1 16 Tf 72 760 Td (${line}) Tj ET`;
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
  ];
}

const xrefEntryOf = (offset: number) => `${String(offset).padStart(10, '0')} 00000 n \n`;

export function demoCvPdf(content: DemoCvContent): Uint8Array {
  const objects = pageObjectsOf(content).map(
    (object, index) => `${String(index + 1)} 0 obj\n${object}\nendobj\n`,
  );
  let end = PDF_HEADER.length;
  const offsets = objects.map((object) => {
    const start = end;
    end += object.length;
    return start;
  });
  const size = String(objects.length + 1);
  const xref = `xref\n0 ${size}\n0000000000 65535 f \n${offsets.map(xrefEntryOf).join('')}`;
  const trailer = `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${String(end)}\n%%EOF\n`;
  return new TextEncoder().encode(`${PDF_HEADER}${objects.join('')}${xref}${trailer}`);
}
