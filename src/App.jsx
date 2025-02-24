import { Moon, RefreshCw, Sun } from "lucide-react";
import React, { useEffect, useState } from "react";
import logoimg from "./assets/ff.avif";
import FullScreenPopup from "./FullScreenPopup";
import { FetchService } from "./services/fetchService";
import { SearchService } from "./services/SearchService";

const CACHE_DURATION = 60 * 60 * 1000;
const MAX_TITLE_LENGTH = 60;
const RESULTS_PER_PAGE = 5;
const MAX_RECENT_NOVELS = 3;

const LinkTable = () => {
  const [links, setLinks] = useState([]);
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false); // State for full-screen popup
  const [selectedUrl, setSelectedUrl] = useState(""); // Store selected URL
  const [searchService] = useState(new SearchService());
  const [recentNovels, setRecentNovels] = useState([]);
  const [timestamp, setTimestamp] = useState(null);

  // Helper functions and fetch logic remain unchanged
  const cleanGoogleLink = (link) => {
    return link.replace("https://www.google.com/url?q=", "").split("&")[0];
  };

  const truncateTitle = (title) => {
    return title.length > MAX_TITLE_LENGTH
      ? `${title.slice(0, MAX_TITLE_LENGTH)}...`
      : title;
  };

  const initializeSearch = (links) => {
    searchService.initialize(links);
  };

  const fetchLinks = async (forceFetch = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const { links: fetchedLinks, timestamp } = await FetchService
        .refreshLinks(forceFetch);

      if (timestamp) {
        console.log(`Data updated at ${new Date(timestamp).toLocaleString()}`);
        setTimestamp(timestamp);
      }

      setLinks(fetchedLinks);
      initializeSearch(fetchedLinks);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching links:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (event) => {
    const query = event.target.value;
    setSearchQuery(query);
    setFilteredLinks(searchService.search(query, RESULTS_PER_PAGE));
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("darkMode", newMode);
      document.documentElement.setAttribute(
        "data-theme",
        newMode ? "night" : "tree",
      );
      return newMode;
    });
  };

  const loadRecentNovels = () => {
    const stored = localStorage.getItem("recentNovels");
    return stored ? JSON.parse(stored) : [];
  };

  const saveRecentNovel = (link, title) => {
    const recent = loadRecentNovels();
    const novel = { link, title };

    // Remove if already exists
    const filtered = recent.filter((item) => item.link !== link);

    // Add to beginning and limit to MAX_RECENT_NOVELS
    const updated = [novel, ...filtered].slice(0, MAX_RECENT_NOVELS);

    localStorage.setItem("recentNovels", JSON.stringify(updated));
    setRecentNovels(updated);
  };

  const handleGetButtonClick = (link, title) => {
    setSelectedUrl(link); // Set the URL to display in the popup
    setIsPopupOpen(true); // Open the full-screen popup
    saveRecentNovel(link, title);
  };

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    document.documentElement.setAttribute(
      "data-theme",
      savedDarkMode ? "night" : "fantasy",
    );
    fetchLinks();
    setRecentNovels(loadRecentNovels());
  }, []);

  const displayLinks = filteredLinks.length > 0
    ? filteredLinks
    : links.slice(0, RESULTS_PER_PAGE);

  return (
    <div
      data-theme="tree"
      className="min-h-screen transition-all duration-300 bg-gradient-to-br from-base-300 via-base-200 to-base-300 "
    >
      <div className="container mx-auto p-4 md:p-8 max-w-5xl">
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body p-4 md:p-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                <div className="avatar">
                  <div className="w-20 md:w-16 h-20 md:h-16 rounded-full ring ring-primary ring-offset-2 ring-offset-base-100">
                    <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                      <img
                        src={logoimg} // Assuming logoimg is the URL of the image
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <h1 className="text-3xl md:text-4xl font-bold text-primary">
                    Light Novel Download
                  </h1>
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                    <p className="text-base-content/60">
                      Discover your next read
                    </p>
                    <div className="badge badge-neutral">
                      {links.length} novels
                    </div>
                    {timestamp && (
                      <div className="badge badge-ghost">
                        Updated: {new Date(timestamp).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => fetchLinks(true)}
                  disabled={isLoading}
                  className="btn btn-primary gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                  <span className="hidden md:inline">
                    {isLoading ? "Loading" : "Refresh"}
                  </span>
                </button>
                <button
                  onClick={toggleDarkMode}
                  className="btn btn-ghost btn-circle"
                >
                  {isDarkMode
                    ? <Sun className="w-5 h-5 text-warning" />
                    : <Moon className="w-5 h-5 text-primary" />}
                </button>
              </div>
            </div>

            <div className="divider my-2 md:my-4"></div>

            {/* Search Section */}
            <div className="form-control">
              <input
                type="search"
                placeholder="Search novels..."
                value={searchQuery}
                onChange={handleSearch}
                className="input input-bordered w-full transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Content Section */}
            {error
              ? (
                <div className="alert alert-error shadow-lg mt-6">
                  <span className="font-medium">Error: {error}</span>
                </div>
              )
              : (
                <div className="overflow-x-auto mt-6">
                  {searchQuery && filteredLinks.length === 0
                    ? (
                      <div className="text-center py-8">
                        <div className="text-base-content/60 text-lg">
                          No results found for "{searchQuery}"
                        </div>
                        <p className="text-base-content/40 mt-2">
                          Try different keywords or refresh the list
                        </p>
                      </div>
                    )
                    : !searchQuery
                    ? (
                      <div className="space-y-6">
                        {recentNovels.length > 0 && (
                          <>
                            <div className="text-center md:text-left">
                              <h2 className="text-xl font-semibold text-base-content/80">
                                Recently Opened Novels
                              </h2>
                            </div>
                            <div className="grid gap-4">
                              {recentNovels.map((
                                { link, title },
                                index,
                              ) => (
                                <div
                                  key={index}
                                  className="card bg-base-200 shadow-sm hover:shadow-md transition-all"
                                >
                                  <div className="card-body p-4 flex-row justify-between items-center">
                                    <h3 className="card-title text-base font-medium">
                                      {truncateTitle(title)}
                                    </h3>
                                    <button
                                      onClick={() =>
                                        handleGetButtonClick(link, title)}
                                      className="btn btn-primary btn-sm gap-1"
                                    >
                                      Get →
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )
                    : (
                      <div className="grid gap-4">
                        {displayLinks.map(({ link, title }, index) => (
                          <div
                            key={index}
                            className="card bg-base-200 hover:bg-base-300 shadow-sm hover:shadow-md transition-all duration-200 ease-in-out"
                          >
                            <div className="card-body p-4 flex-row justify-between items-center">
                              <h3 className="card-title text-base font-medium hover:text-primary transition-colors">
                                {truncateTitle(title)}
                              </h3>
                              <button
                                onClick={() =>
                                  handleGetButtonClick(link, title)}
                                className="btn btn-primary btn-sm gap-1 hover:scale-105 transition-transform"
                              >
                                Get →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Full-Screen Popup */}
      {isPopupOpen && (
        <FullScreenPopup
          selectedUrl={selectedUrl}
          onClose={() => setIsPopupOpen(false)}
        />
      )}
    </div>
  );
};

export default LinkTable;
