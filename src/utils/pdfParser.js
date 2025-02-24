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

function extractUpdateTime(textContent) {
  for (const item of textContent.items) {
    // Look specifically for the update time pattern
    const match = item.str.match(
      /Last update:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i
    );
    if (match) {
      console.log("Found update time:", match[1]); // Debug logging
      const [, dateStr] = match;
      const [date, time] = dateStr.split(" ");
      const [day, month, year] = date.split("/");
      const [hours, minutes] = time.split(":");
      return new Date(year, month - 1, day, hours, minutes).getTime();
    }
  }
  return null;
}

async function parsePdf(pdfData) {
  try {
    const linkData = [];
    let updateTimestamp = null;
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDocument = await loadingTask.promise;

    // Extract update time from first page
    const firstPage = await pdfDocument.getPage(1);
    const firstPageText = await firstPage.getTextContent();
    updateTimestamp = extractUpdateTime(firstPageText);
    console.log("Extracted timestamp:", updateTimestamp); // Debug logging

    // Continue parsing rest of the pages
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

    return {
      links: linkData,
      updateTimestamp: updateTimestamp || Date.now(), // Fallback to current time if not found
    };
  } catch (error) {
    console.error("PDF parsing error:", error); // Debug logging
    throw new Error(`PDF parsing error: ${error.message}`);
  }
}

export { fetchPdfFromUrl, parsePdf };
