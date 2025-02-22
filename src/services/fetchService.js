import { cleanGoogleLink, extractMegaId } from "../utils/mega";
import { DatabaseService } from "./db";

export class FetchService {
  static SPREADSHEET_URL =
    "https://cloudflare-cors-anywhere.hackmeforlife.workers.dev/?https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSvd0SjjPYZKzhUwTYK2n2peZD_n6_wDmEKV3I37nuM-FnOtAU5xZkec35GabjrZ6olJTbr_CMXS6AH/pubhtml?pli=1";

  static async fetchAndProcessLinks() {
    const response = await fetch(this.SPREADSHEET_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = Array.from(doc.querySelectorAll("tbody tr"));

    return rows
      .map((row) => {
        const linkElement = row.querySelector("a");
        if (!linkElement?.href) return null;

        const degoogle_link = cleanGoogleLink(linkElement.href);
        const link = decodeURI(degoogle_link);
        const megaId = extractMegaId(link);

        return {
          link,
          megaId,
          title: row.querySelectorAll("td")[1]?.textContent || "Untitled",
          timestamp: Date.now(),
          status: "active", // Add status field for better record management
        };
      })
      .filter(Boolean);
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
