import fuzzysort from "fuzzysort";
import { Moon, RefreshCw, Sun } from "lucide-react";
import React, { useEffect, useState } from "react";
import logoimg from "./assets/ff.avif";
import FullScreenPopup from './FullScreenPopup';

const CACHE_DURATION = 60 * 60 * 1000;
const MAX_TITLE_LENGTH = 60;
const RESULTS_PER_PAGE = 5;

const LinkTable = () => {
  const [links, setLinks] = useState([]);
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false); // State for full-screen popup
  const [selectedUrl, setSelectedUrl] = useState(""); // Store selected URL

  // Helper functions and fetch logic remain unchanged
  const cleanGoogleLink = (link) => {
    return link.replace("https://www.google.com/url?q=", "").split("&")[0];
  };

  const truncateTitle = (title) => {
    return title.length > MAX_TITLE_LENGTH
      ? `${title.slice(0, MAX_TITLE_LENGTH)}...`
      : title;
  };

  const fetchLinks = async (forceFetch = false) => {
    setIsLoading(true);
    setError(null);

    const cachedData = localStorage.getItem("linkData");
    const cacheTime = localStorage.getItem("linkDataCacheTime");
    const isCacheValid = cachedData &&
      cacheTime &&
      !forceFetch &&
      Date.now() - parseInt(cacheTime) < CACHE_DURATION;

    if (isCacheValid) {
      setLinks(JSON.parse(cachedData));
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "https://cloudflare-cors-anywhere.hackmeforlife.workers.dev/?https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSvd0SjjPYZKzhUwTYK2n2peZD_n6_wDmEKV3I37nuM-FnOtAU5xZkec35GabjrZ6olJTbr_CMXS6AH/pubhtml?pli=1",
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const rows = Array.from(doc.querySelectorAll("tbody tr"));

      const processedLinks = rows
        .map((row) => {
          const linkElement = row.querySelector("a");
          if (!linkElement?.href) return null;

          return {
            link: cleanGoogleLink(linkElement.href),
            title: row.querySelectorAll("td")[1]?.textContent || "Untitled",
          };
        })
        .filter(Boolean);

      const preparedLinks = processedLinks.map((link) => ({
        ...link,
        prepared: fuzzysort.prepare(link.title),
      }));

      localStorage.setItem("linkData", JSON.stringify(preparedLinks));
      localStorage.setItem("linkDataCacheTime", Date.now().toString());

      setLinks(preparedLinks);
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

    if (!query) {
      setFilteredLinks([]);
      return;
    }

    const results = fuzzysort.go(query, links, {
      key: "title",
      limit: RESULTS_PER_PAGE,
      threshold: -100000,
    });

    const filtered = results.map((result) => ({
      title: result.obj.title,
      link: result.obj.link,
    }));

    setFilteredLinks(filtered);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("darkMode", isDarkMode);
      document.documentElement.setAttribute("data-theme", newMode ? "dark" : "cupcake");
      return newMode;
    });
  };

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    document.documentElement.setAttribute("data-theme", savedDarkMode ? "night" : "fantasy");
    fetchLinks();
  }, []);

  const displayLinks = filteredLinks.length > 0
    ? filteredLinks
    : links.slice(0, RESULTS_PER_PAGE);

  const handleGetButtonClick = (link) => {
    setSelectedUrl(link); // Set the URL to display in the popup
    setIsPopupOpen(true);  // Open the full-screen popup
  };

  return (
    <div className="min-h-screen transition-all duration-300 bg-gradient-to-br from-base-300 via-base-200 to-base-300">
      <div className="container mx-auto px-4 py-8">
        <div className="card w-full bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="avatar">
                  <div className="w-16 h-16 rounded-full ring ring-primary ring-offset-2 ring-offset-base-100">
                    <div className="bg-primary/10 w-full h-full flex items-center justify-center">
                      <img 
                        src={logoimg} // Assuming logoimg is the URL of the image
                        alt="Logo" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-primary">Light Novel Download</h1>
                  <p className="text-base-content/60">Discover your next read</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => fetchLinks(true)}
                  disabled={isLoading}
                  className="btn btn-primary gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                  {isLoading ? "Loading" : "Refresh"}
                </button>
                <button
                  onClick={toggleDarkMode}
                  className="btn btn-ghost btn-circle btn-lg"
                >
                  {isDarkMode 
                    ? <Sun className="w-6 h-6 text-warning" />
                    : <Moon className="w-6 h-6 text-primary" />
                  }
                </button>
              </div>
            </div>

            <div className="divider"></div>

            <div className="form-control">
              <div className="input-group">

                <input
                  type="search"
                  placeholder="Search novels..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="input input-bordered w-full"
                />
              </div>
            </div>

            {error ? (
              <div className="alert alert-error shadow-lg mt-6">
                <span className="font-medium">Error: {error}</span>
              </div>
            ) : (
              <div className="overflow-x-auto mt-6">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th className="bg-base-200 text-base-content/70 font-medium">Title</th>
                      <th className="bg-base-200 text-base-content/70 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLinks.map(({ link, title }, index) => (
                      <tr key={index}>
                        <td className="font-medium">{truncateTitle(title)}</td>
                        <td className="text-right">
                          <button
                            onClick={() => handleGetButtonClick(link)} // Open popup with URL
                            className="btn btn-primary btn-sm gap-1"
                          >
                            Get →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
