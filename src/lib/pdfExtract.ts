import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface PdfItem {
  str: string;
  transform: number[];
}

export async function extractLinesFromPDF(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const items: Array<{ x: number; y: number; str: string }> = [];
    for (const raw of content.items) {
      const item = raw as unknown as PdfItem;
      if (!item.str?.trim()) continue;
      const [, , , , x, y] = item.transform;
      items.push({ x, y: Math.round(y), str: item.str });
    }

    // Group by Y with ±3 tolerance → each group = one visual line
    const groups: Array<{ y: number; items: Array<{ x: number; str: string }> }> = [];
    for (const item of items) {
      const g = groups.find(g => Math.abs(g.y - item.y) <= 3);
      if (g) {
        g.items.push({ x: item.x, str: item.str });
      } else {
        groups.push({ y: item.y, items: [{ x: item.x, str: item.str }] });
      }
    }

    // Sort top-to-bottom (higher Y value = higher on PDF page)
    groups.sort((a, b) => b.y - a.y);

    for (const g of groups) {
      const line = g.items
        .sort((a, b) => a.x - b.x)
        .map(i => i.str.trim())
        .filter(Boolean)
        .join('  ');
      if (line) allLines.push(line);
    }
  }

  return allLines;
}
