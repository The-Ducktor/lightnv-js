import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

// Ensure worker is initialized only once
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

async function fetchPdfFromUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    throw new Error(`Failed to fetch PDF: ${error.message}`);
  }
}

function sanitizeTitle(title) {
  return title
    .replace(/\s+/g, " ") // normalize whitespace
    .replace(/^\s*!/, "") // remove leading '!'
    .replace(/^MEGA\s+/i, "") // remove leading "MEGA " (case insensitive)
    .trim();
}

async function parsePdf(pdfData) {
  try {
    const linkData = [];
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDocument = await loadingTask.promise;
    const numPages = pdfDocument.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const annotations = await page.getAnnotations();

      const lineGroups = new Map();

      textContent.items.forEach((item) => {
        const y = Math.round(item.transform[5]);
        if (!lineGroups.has(y)) {
          lineGroups.set(y, { items: [] });
        }
        lineGroups.get(y).items.push(item);
      });

      annotations.forEach((annotation) => {
        if (!annotation.url) return;
        const y = Math.round(annotation.rect[1]);

        let closestY = Array.from(lineGroups.keys()).reduce((prev, curr) =>
          Math.abs(curr - y) < Math.abs(prev - y) ? curr : prev
        );

        if (Math.abs(closestY - y) < 20) {
          lineGroups.get(closestY).annotation = annotation;
        }
      });

      for (const [y, row] of lineGroups) {
        if (!row.annotation) continue;
        row.items.sort((a, b) => a.transform[4] - b.transform[4]);
        const title = row.items
          .map((item) => item.str)
          .join(" ")
          .trim();

        if (title && row.annotation.url) {
          linkData.push({
            title: sanitizeTitle(title),
            link: row.annotation.url,
          });
        }
      }
    }

    if (linkData.length === 0) {
      console.warn("No links found in PDF document");
    }

    return linkData;
  } catch (error) {
    throw new Error(`PDF parsing error: ${error.message}`);
  }
}

export { fetchPdfFromUrl, parsePdf };
