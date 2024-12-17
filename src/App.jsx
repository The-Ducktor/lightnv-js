import React, { useState, useEffect } from "react";
import fuzzysort from "fuzzysort";
import logo from './assets/ff.avif';

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_TITLE_LENGTH = 60;
const RESULTS_PER_PAGE = 5;

const LinkTable = () => {
  const [links, setLinks] = useState([]);
  const [filteredLinks, setFilteredLinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
    const isCacheValid =
      cachedData &&
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

      // Prepare the data for fuzzysort
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

    // Use fuzzysort to search through the prepared titles
    const results = fuzzysort.go(query, links, {
      key: "title",
      limit: RESULTS_PER_PAGE,
      threshold: -100000, // Adjust this value to control strictness
    });

    // Convert results back to our expected format
    const filtered = results.map((result) => ({
      title: result.obj.title,
      link: result.obj.link,
    }));

    setFilteredLinks(filtered);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("darkMode", newMode.toString());
      return newMode;
    });
  };

  useEffect(() => {
    setIsDarkMode(localStorage.getItem("darkMode") === "true");
    fetchLinks();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const displayLinks =
    filteredLinks.length > 0 ? filteredLinks : links.slice(0, RESULTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 transition-colors duration-300 flex items-center justify-center">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex flex-row items-center justify-between pb-6">
            <div className="flex items-center">
              <img
                src={logo}
                alt="Logo of Cat Girl Looking at light Novels"
                className="mb-0 h-auto max-h-[5em] object-contain"
              />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white ml-4 p-2 pr-5">
              MEGA Light Novel Links
            </h1>
            <div className="flex gap-4">
              <button
                onClick={() => fetchLinks(true)}
                disabled={isLoading}
                className="px-6 py-3 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 border border-transparent rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? "Loading..." : "Refresh"}
              </button>
              <button
                onClick={toggleDarkMode}
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              >
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <input
              type="search"
              placeholder="Search novels..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
            />
          </div>

          {error ? (
            <div className="text-red-500 dark:text-red-400 p-4 text-center">
              Error: {error}
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="w-24 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {displayLinks.map(({ link, title }, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {truncateTitle(title)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Visit →
                        </a>
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
  );
};

export default LinkTable;
