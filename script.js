const proxyUrl = "https://cors.tailc0e85.ts.net/";
const url = "https://docs.google.com/spreadsheets/u/0/d/e/2PACX-1vSvd0SjjPYZKzhUwTYK2n2peZD_n6_wDmEKV3I37nuM-FnOtAU5xZkec35GabjrZ6olJTbr_CMXS6AH/pubhtml?pli=1";

// Global variable to store fetched data
let linkTitlePairs = [];




// Toggle dark mode and save preference to localStorage
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const isDarkMode = document.documentElement.classList.toggle("dark");
  localStorage.setItem("darkMode", isDarkMode);
});

// Initialize dark mode from localStorage
if (localStorage.getItem("darkMode") === "true") {
  document.documentElement.classList.add("dark");
}

// Clean Google link by removing unwanted parts
function cleanGoogleLink(url) {
  return url.replace("https://www.google.com/url?q=", "").split("&")[0];
}

// Fetch data from localStorage or Google Sheets
async function fetchAndDisplayData() {
  const cachedData = localStorage.getItem("linkTitlePairs");
  const cacheTime = localStorage.getItem("cacheTime");
  const oneHourInMilliseconds = 60 * 60 * 1000;

  if (cachedData && cacheTime && Date.now() - cacheTime < oneHourInMilliseconds) {
    linkTitlePairs = JSON.parse(cachedData);
  } else {
    try {
      const response = await fetch(proxyUrl + url);
      if (!response.ok) throw new Error(`Failed to retrieve content: ${response.status}`);
      
      const htmlContent = await response.text();
      const doc = new DOMParser().parseFromString(htmlContent, "text/html");
      const rows = doc.querySelectorAll("tbody tr");

      linkTitlePairs = Array.from(rows).map(row => {
        const linkTag = row.querySelector("a");
        if (linkTag?.hasAttribute("href")) {
          return { 
            link: cleanGoogleLink(linkTag.getAttribute("href")),
            title: row.querySelectorAll("td")[1].textContent 
          };
        }
      }).filter(Boolean);

      // Cache the results
      localStorage.setItem("linkTitlePairs", JSON.stringify(linkTitlePairs));
      localStorage.setItem("cacheTime", Date.now());
    } catch (error) {
      console.error(`Error fetching data: ${error.message}`);
    }
  }
  populateTable(linkTitlePairs);
}

// Truncate title if it's longer than 60 characters
function truncateTitle(title) {
  return title.length > 60 ? `${title.slice(0, 60)}...` : title;
}


// Populate the table with data
function populateTable(data) {
  const tableBody = document.querySelector("#linksTable tbody");

  // Hide the table to avoid flickering
  tableBody.classList.add("hidden");

  // Create a DocumentFragment to batch updates
  const fragment = document.createDocumentFragment();

  // Create new rows
  data.slice(0, 3).forEach(({ link, title }) => {
    const row = document.createElement("tr");
    row.classList.add("fade-in", "hover:bg-gray-100", "dark:hover:bg-gray-700", "transition-colors", "duration-200");

    row.innerHTML = `
      <td class="px-4 py-2">
        <a href="${link}" target="_blank" style="color: inherit; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${truncateTitle(title)}
        </a>
      </td>
      <td class="px-4 py-2">
        <a href="${link}" target="_blank" class="text-blue-500 dark:text-blue-400 hover:underline">View Link</a>
      </td>
    `;

    fragment.appendChild(row); // Add the new row to the fragment
  });

  // Remove old rows
  while (tableBody.firstChild) {
    tableBody.removeChild(tableBody.firstChild);
  }

  // Append all new rows at once
  tableBody.appendChild(fragment);

  // Show the table again after a short delay
  setTimeout(() => {
    tableBody.classList.remove("hidden");
  }, 0); // Use 0ms delay to ensure it executes after the DOM update
}

// Get random pairs of links
function getRandomPairs(array, numPairs) {
  return array.sort(() => Math.random() - 0.5).slice(0, numPairs);
}

// Handle search input with fuzzy search
document.getElementById("searchBox").addEventListener("input", function () {
  const filter = this.value;
  const results = filter ? fuzzysort.go(filter, linkTitlePairs, { key: "title", limit: 3 }) : [];
  
  const filteredData = results.length ? results.map(result => result.obj) : getRandomPairs(linkTitlePairs, 3);
  populateTable(filteredData);
});

// Fetch and display data on page load
fetchAndDisplayData();
