import { cleanGoogleLink, extractMegaId } from "../utils/mega";
import { fetchPdfFromUrl, parsePdf } from "../utils/pdfParser";
import { DatabaseService } from "./db";

export class FetchService {
  static SPREADSHEET_URL =
    "https://cloudflare-cors-anywhere.hackmeforlife.workers.dev/?https://docs.google.com/spreadsheets/d/e/2PACX-1vSvd0SjjPYZKzhUwTYK2n2peZD_n6_wDmEKV3I37nuM-FnOtAU5xZkec35GabjrZ6olJTbr_CMXS6AH/pub?output=pdf";

  static async fetchAndProcessLinks(retryCount = 0) {
    try {
      const pdfData = await fetchPdfFromUrl(this.SPREADSHEET_URL);
      if (!pdfData || pdfData.length === 0) {
        throw new Error("Failed to fetch PDF data");
      }

      const { links: rawLinks, updateTimestamp } = await parsePdf(pdfData);
      if (!rawLinks || rawLinks.length === 0) {
        throw new Error("No links found in PDF");
      }

      // Check if first page contains "Loading..."
      if (rawLinks[0]?.title?.includes("Loading...")) {
        if (retryCount < 3) {
          // Wait for 2 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.fetchAndProcessLinks(retryCount + 1);
        } else {
          // After 3 retries, try to get old data
          const { links } = await DatabaseService.getLinks();
          if (links.length > 0) {
            return links;
          }
          throw new Error(
            "Sheet is still loading and no cached data available"
          );
        }
      }

      const processedLinks = rawLinks
        .map((item) => {
          try {
            const degoogle_link = cleanGoogleLink(item.link);
            const link = decodeURI(degoogle_link);
            const megaId = extractMegaId(link);

            return {
              link,
              megaId,
              title: item.title || "Untitled",
              timestamp: updateTimestamp || Date.now(), // Use PDF's update timestamp
              status: "active",
            };
          } catch (err) {
            console.error(`Failed to process link: ${item.link}`, err);
            return null;
          }
        })
        .filter(Boolean);

      return { links: processedLinks, updateTimestamp };
    } catch (error) {
      console.error("PDF processing error:", error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  static async refreshLinks(forceFetch = false) {
    try {
      if (!forceFetch) {
        const { links, metadata } = await DatabaseService.getLinks();
        if (links.length > 0 && !(await DatabaseService.isDataStale())) {
          return {
            links,
            fromCache: true,
            timestamp: metadata?.updateTimestamp,
          };
        }
      }

      const { links, updateTimestamp } = await this.fetchAndProcessLinks();

      // Check if we need to update the database
      const lastUpdateTimestamp =
        await DatabaseService.getLastUpdateTimestamp();
      const shouldUpdate =
        forceFetch ||
        !lastUpdateTimestamp ||
        lastUpdateTimestamp !== updateTimestamp;

      if (shouldUpdate) {
        console.log("Updating database with new data...");
        await DatabaseService.saveLinks(links, updateTimestamp);
      } else {
        console.log("No new updates, skipping database write");
      }

      return {
        links,
        fromCache: false,
        timestamp: updateTimestamp,
      };
    } catch (error) {
      throw new Error(`Failed to refresh links: ${error.message}`);
    }
  }
}
