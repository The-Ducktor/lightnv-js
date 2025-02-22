import fuzzysort from "fuzzysort";
import MiniSearch from "minisearch";

export class SearchService {
  constructor() {
    this.miniSearch = null;
    this.fuzzyPrepared = null;
  }

  initialize(items) {
    // Initialize MiniSearch
    this.miniSearch = new MiniSearch({
      fields: ["title"],
      storeFields: ["title", "link"],
      searchOptions: {
        fuzzy: 0.4,
        prefix: true,
        boost: { title: 2 },
        combineWith: "OR",
      },
    });

    // Prepare data for fuzzysort
    this.fuzzyPrepared = items.map((item) => ({
      ...item,
      prepared: fuzzysort.prepare(item.title),
    }));

    this.miniSearch.addAll(
      items.map((item, index) => ({ ...item, id: index }))
    );
  }

  search(query, limit = 5) {
    if (!query) return [];

    // Get MiniSearch results with higher weight
    const miniResults = this.miniSearch.search(query, {
      boost: { title: 2 },
      fuzzy: 0.4,
      prefix: true,
    });

    // Get FuzzySort results as fallback for typos
    const fuzzyResults = fuzzysort.go(query, this.fuzzyPrepared, {
      key: "title",
      limit: limit * 2,
      threshold: -10000,
    });

    // Merge results with preference for MiniSearch
    const mergedResults = new Map();

    // Add MiniSearch results with higher weight
    miniResults.forEach((result) => {
      mergedResults.set(result.link, {
        ...result,
        score: result.score * 150, // Increased weight for MiniSearch results
      });
    });

    // Add FuzzySort results as supplementary
    fuzzyResults.forEach((result) => {
      const existing = mergedResults.get(result.obj.link);
      if (existing) {
        // Add small boost if found by both engines
        existing.score += result.score + 500;
      } else {
        mergedResults.set(result.obj.link, {
          ...result.obj,
          score: result.score + 500,
        });
      }
    });

    return Array.from(mergedResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
