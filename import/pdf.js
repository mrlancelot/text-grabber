import * as pdfjs from "../vendor/pdfjs/pdf.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

export async function readPdf(file) {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
  const { info } = await doc.getMetadata();
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    pages.push(items.map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], size: i.transform[3] })));
  }
  return { author: info?.Author || "", pages };
}
