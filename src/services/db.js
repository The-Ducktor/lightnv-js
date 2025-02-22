const DB_NAME = "lightnvDB";
const DB_VERSION = 2; // Increased version number
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
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          // Create initial stores
          db.createObjectStore(STORES.links, {
            keyPath: "id",
            autoIncrement: true,
          });
          db.createObjectStore(STORES.metadata, { keyPath: "key" });
        }

        if (oldVersion < 2) {
          // Add indexes for better querying
          const linkStore = event.target.transaction.objectStore(STORES.links);
          linkStore.createIndex("megaId", "megaId", { unique: false });
          linkStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  static async saveLinks(links) {
    const db = await this.initDB();
    const timestamp = Date.now();

    return await this.runTransaction(
      [STORES.links, STORES.metadata],
      async (stores) => {
        const [linksStore, metadataStore] = stores;

        // Batch delete old records
        await this.clearStore(linksStore);

        // Batch insert new records
        const chunkedLinks = this.chunkArray(links, 100);
        for (const chunk of chunkedLinks) {
          await Promise.all(
            chunk.map((link) =>
              this.addToStore(linksStore, {
                ...link,
                version: DB_VERSION,
                lastUpdated: timestamp,
              })
            )
          );
        }

        // Update metadata
        await this.addToStore(metadataStore, {
          key: "lastUpdate",
          timestamp,
          count: links.length,
          version: DB_VERSION,
        });

        return { timestamp, count: links.length };
      }
    );
  }

  static async getLinks() {
    return await this.runTransaction(
      [STORES.links, STORES.metadata],
      async (stores) => {
        const [linksStore, metadataStore] = stores;

        const links = await this.getAllFromStore(linksStore);
        const metadata = await this.getFromStore(metadataStore, "lastUpdate");

        return { links, metadata };
      },
      "readonly"
    );
  }

  // Helper methods for better transaction management
  static async runTransaction(storeNames, callback, mode = "readwrite") {
    const db = await this.initDB();
    const tx = db.transaction(storeNames, mode);
    const stores = storeNames.map((name) => tx.objectStore(name));

    try {
      const result = await callback(stores);
      return await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      tx.abort();
      throw error;
    }
  }

  static chunkArray(array, size) {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, (i + 1) * size)
    );
  }

  static addToStore(store, item) {
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static getAllFromStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static getFromStore(store, key) {
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static clearStore(store) {
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async invalidateCache() {
    return await this.runTransaction(
      [STORES.links, STORES.metadata],
      async (stores) => {
        const [linksStore, metadataStore] = stores;
        await this.clearStore(linksStore);
        await this.clearStore(metadataStore);
      }
    );
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
