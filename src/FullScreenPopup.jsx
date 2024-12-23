import JSZip from "jszip"; // Import JSZip for zipping files
import { File } from "megajs";
import React, { useEffect, useState } from "react";

const FullScreenPopup = ({ selectedUrl, onClose }) => {
  const [children, setChildren] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false); // Track download state
  const [isSelectAll, setIsSelectAll] = useState(false); // Track Select All button state

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const deurl = decodeURIComponent(selectedUrl);
        const megaFile = File.fromURL(deurl);
        await megaFile.loadAttributes(); // Load attributes to get the folder's children
        const filteredFiles = megaFile.children.filter(file => file.name.endsWith(".epub")); // Filter only .epub files
        setChildren(filteredFiles); // Store the filtered files
      } catch (err) {
        setError("Error loading files from MEGA: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [selectedUrl]);

  const handleCheckboxChange = (file) => {
    setSelectedFiles((prevSelectedFiles) => {
      if (prevSelectedFiles.includes(file)) {
        return prevSelectedFiles.filter((selectedFile) => selectedFile !== file);
      } else {
        return [...prevSelectedFiles, file];
      }
    });
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      setSelectedFiles([]); // Deselect all files
    } else {
      setSelectedFiles(children); // Select all files
    }
    setIsSelectAll(!isSelectAll); // Toggle the Select All state
  };

  const handleDownloadClick = async () => {
    setIsDownloading(true); // Start downloading
    const zip = new JSZip(); // Initialize a new zip file

    try {
      // Add each selected file to the zip
      for (const file of selectedFiles) {
        const buffer = await file.downloadBuffer(); // Get the file buffer
        zip.file(file.name, buffer); // Add file to zip
      }

      // Generate the zip file
      const content = await zip.generateAsync({ type: "blob" });

      // Trigger download of the zip file
      const a = document.createElement("a");
      const url = URL.createObjectURL(content);
      a.href = url;
      a.download = "novels.zip"; // Name the zip file

      // Append the anchor element to the body, click it, and remove it afterward
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url); // Clean up the object URL
      a.remove();
    } catch (err) {
      setError("Failed to download selected files: " + err.message);
    } finally {
      setIsDownloading(false); // Stop downloading
      onClose(); // Close the popup after download
    }
  };

  if (loading) {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
        <div className="bg-neutral p-8 rounded-lg w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Loading files from MEGA...</h2>
          <div className="text-sm text-gray-500">Please wait while we fetch the files.</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
        <div className="bg-red-600 text-white p-8 rounded-lg w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Error: {error}</h2>
          <button onClick={onClose} className="btn btn-ghost mt-4 text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-70 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-neutral p-8 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Download Options</h2>

        {/* Select All Button */}
        <button
          onClick={handleSelectAll}
          className="btn btn-secondary mb-4 w-full"
        >
          {isSelectAll ? "Deselect All" : "Select All"}
        </button>

        {/* Scrollable container for checkboxes */}
        <div className="max-h-64 overflow-y-auto mb-4">
          {children.length > 0 ? (
            children.map((child, index) => (
              <div key={index} className="flex items-center mb-2 hover:bg-gray-700 rounded-lg p-2">
                <input
                  type="checkbox"
                  id={`file-${index}`}
                  className="mr-2 w-5 h-5 border-gray-300 rounded"
                  onChange={() => handleCheckboxChange(child)}
                  checked={selectedFiles.includes(child)}
                />
                <label htmlFor={`file-${index}`} className="text-sm text-gray-300">
                  {child.name}
                </label>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No .epub files found in this folder.</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between gap-4">
          <button
            onClick={handleDownloadClick}
            className="btn btn-primary w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={selectedFiles.length === 0 || isDownloading}
          >
            {isDownloading ? (
              <div className="loader"> {/* Simple loader/spinner */} </div>
            ) : selectedFiles.length === 0 ? (
              "Select files first"
            ) : (
              "Download Selected"
            )}
          </button>
          <button onClick={onClose} className="btn btn-ghost w-full text-sm text-gray-400 hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FullScreenPopup;
