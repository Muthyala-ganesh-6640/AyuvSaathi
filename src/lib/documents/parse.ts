import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";

export async function extractPdfText(buffer: Buffer) {
  const { text } = await extractText(new Uint8Array(buffer));
  const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
  return joined.replace(/\u0000/g, "").trim();
}

export async function renderPdfPages(buffer: Buffer, maxPages = 6) {
  const document = await getDocumentProxy(new Uint8Array(buffer));
  const totalPages = document.numPages;
  const pagesToRender = Math.min(totalPages, maxPages);
  const images: { mimeType: "image/png"; base64: string }[] = [];

  try {
    for (let page = 1; page <= pagesToRender; page += 1) {
      const dataUrl = await renderPageAsImage(document, page, {
        canvasImport: () => import("@napi-rs/canvas"),
        width: 1600,
        toDataURL: true,
      });
      const base64 = dataUrl.match(/^data:image\/png;base64,(.+)$/)?.[1];
      if (!base64) {
        throw new Error(`Unable to render PDF page ${page} as an image.`);
      }
      images.push({ mimeType: "image/png", base64 });
    }
  } finally {
    await document.cleanup();
  }

  return { images, totalPages };
}

export function looksLikeHandwritingNote(text: string) {
  return text.length < 40;
}
