import { cleanGoogleLink, extractMegaId } from "../utils/mega";
import { fetchPdfFromUrl, parsePdf } from "../utils/pdfParser";
import { DatabaseService } from "./db";

export class FetchService {
  static SPREADSHEET_URL =
    "https://cloudflare-cors-anywhere.hackmeforlife.workers.dev/?https://docs.google.com/spreadsheets/d/e/2PACX-1vSvd0SjjPYZKzhUwTYK2n2peZD_n6_wDmEKV3I37nuM-FnOtAU5xZkec35GabjrZ6olJTbr_CMXS6AH/pub?output=pdf";

  static async fetchAndProcessLinks() {
    try {
      const pdfData = await fetchPdfFromUrl(this.SPREADSHEET_URL);
      if (!pdfData || pdfData.length === 0) {
        throw new Error("Failed to fetch PDF data");
      }

      const rawLinks = await parsePdf(pdfData);
      if (!rawLinks || rawLinks.length === 0) {
        throw new Error("No links found in PDF");
      }

      return rawLinks
        .map((item) => {
          try {
            const degoogle_link = cleanGoogleLink(item.link);
            const link = decodeURI(degoogle_link);
            const megaId = extractMegaId(link);

            return {
              link,
              megaId,
              title: item.title || "Untitled",
              timestamp: Date.now(),
              status: "active",
            };
          } catch (err) {
            console.error(`Failed to process link: ${item.link}`, err);
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      console.error("PDF processing error:", error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  static async refreshLinks(forceFetch = false) {
    try {
      if (forceFetch) {
        await DatabaseService.invalidateCache();
      }

      const shouldFetch = forceFetch || (await DatabaseService.isDataStale());

      if (!shouldFetch) {
        const { links } = await DatabaseService.getLinks();
        if (links.length > 0) {
          return { links, fromCache: true };
        }
      }

      const links = await this.fetchAndProcessLinks();
      const { timestamp } = await DatabaseService.saveLinks(links);

      return {
        links,
        fromCache: false,
        timestamp,
      };
    } catch (error) {
      throw new Error(`Failed to refresh links: ${error.message}`);
    }
  }
}
