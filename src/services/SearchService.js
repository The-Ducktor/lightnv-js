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

  containsMatch(title, query) {
    return title.toLowerCase().includes(query.toLowerCase());
  }

  startsWithMatch(title, query) {
    return title.toLowerCase().startsWith(query.toLowerCase());
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
      const boost = this.calculateBoost(result.title, query);
      mergedResults.set(result.link, {
        ...result,
        score: result.score * 150 + boost, // Base MiniSearch weight + additional boost
      });
    });

    // Add FuzzySort results as supplementary
    fuzzyResults.forEach((result) => {
      const existing = mergedResults.get(result.obj.link);
      const boost = this.calculateBoost(result.obj.title, query);

      if (existing) {
        existing.score += result.score + 500 + boost;
      } else {
        mergedResults.set(result.obj.link, {
          ...result.obj,
          score: result.score + 500 + boost,
        });
      }
    });

    return Array.from(mergedResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  calculateBoost(title, query) {
    let boost = 0;
    if (this.containsMatch(title, query)) {
      boost += 1000; // Significant boost for containing the exact phrase
    }
    if (this.startsWithMatch(title, query)) {
      boost += 2000; // Even higher boost for starting with the phrase
    }
    return boost;
  }
}
