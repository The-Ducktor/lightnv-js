const DB_NAME = "lightnvDB";
const DB_VERSION = 1;
const STORES = {
  links: "links",
  metadata: "metadata",
};

export class DatabaseService {
  static async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create links store
        if (!db.objectStoreNames.contains(STORES.links)) {
          db.createObjectStore(STORES.links, {
            keyPath: "id",
            autoIncrement: true,
          });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(STORES.metadata)) {
          db.createObjectStore(STORES.metadata, { keyPath: "key" });
        }
      };
    });
  }

  static async saveLinks(links) {
    const db = await this.initDB();
    const timestamp = Date.now();

    const tx = db.transaction([STORES.links, STORES.metadata], "readwrite");

    return new Promise((resolve, reject) => {
      try {
        const linksStore = tx.objectStore(STORES.links);
        const metadataStore = tx.objectStore(STORES.metadata);

        // Clear existing data
        linksStore.clear();

        // Add new links
        links.forEach((link) => linksStore.add(link));

        // Update metadata
        metadataStore.put({
          key: "lastUpdate",
          timestamp,
          count: links.length,
        });

        tx.oncomplete = () => resolve({ timestamp, count: links.length });
        tx.onerror = () => reject(tx.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async getLinks() {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.links, STORES.metadata], "readonly");
      const linksStore = tx.objectStore(STORES.links);
      const metadataStore = tx.objectStore(STORES.metadata);

      const links = [];
      let metadata = null;

      linksStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          links.push(cursor.value);
          cursor.continue();
        }
      };

      metadataStore.get("lastUpdate").onsuccess = (event) => {
        metadata = event.target.result;
      };

      tx.oncomplete = () => resolve({ links, metadata });
      tx.onerror = () => reject(tx.error);
    });
  }

  static async isDataStale(maxAge = 60 * 60 * 1000) {
    // Default 1 hour
    try {
      const { metadata } = await this.getLinks();
      if (!metadata) return true;

      return Date.now() - metadata.timestamp > maxAge;
    } catch {
      return true;
    }
  }
}
