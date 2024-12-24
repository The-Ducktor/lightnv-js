import JSZip from "jszip";
import { File } from "megajs";
import { orderBy } from "natural-orderby";
import React, { useEffect, useState } from "react";

const FullScreenPopup = ({ selectedUrl, onClose }) => {
  const [children, setChildren] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({});
  const [totalProgress, setTotalProgress] = useState(0);

  const CONCURRENT_DOWNLOADS = 2; // Max number of concurrent downloads

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    fetchFiles();
  }, [selectedUrl]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const deurl = decodeURIComponent(selectedUrl);
      const megaFile = File.fromURL(deurl);

      await megaFile.loadAttributes();

      if (!megaFile.children) {
        throw new Error("Invalid or expired session. Please reload.");
      }

      const filteredFiles = megaFile.children.filter((file) =>
        file.name.endsWith(".epub")
      );
      setChildren(filteredFiles);
      setError(null);
    } catch (err) {
      if (err.message.includes("Invalid or expired user session")) {
        setTimeout(() => fetchFiles(), 3000);
      } else {
        setError("Error loading files from MEGA: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (file) => {
    setSelectedFiles((prevSelectedFiles) =>
      prevSelectedFiles.includes(file)
        ? prevSelectedFiles.filter((selectedFile) => selectedFile !== file)
        : [...prevSelectedFiles, file]
    );
  };

  const handleSelectAllChange = () => {
    if (selectedFiles.length === children.length) {
      setSelectedFiles([]); // Deselect all
    } else {
      setSelectedFiles(children); // Select all
    }
  };

  const downloadFile = async (file, zip, newProgress) => {
    const fileName = file.name;
    const fileSize = file.size;
    newProgress[fileName] = 0;
    setProgress({ ...newProgress });

    const downloadStream = await file.download();
    const chunks = [];

    downloadStream.on("progress", ({ bytesLoaded }) => {
      newProgress[fileName] = (bytesLoaded / fileSize) * 100;
      setProgress({ ...newProgress });

      const cumulativeProgress =
        Object.values(newProgress).reduce((acc, p) => acc + p, 0) /
        selectedFiles.length;
      setTotalProgress(cumulativeProgress);
    });

    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }

    const concatenated = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(new Uint8Array(chunk), offset);
      offset += chunk.length;
    }

    zip.file(fileName, concatenated);
  };

  const handleDownloadClick = async () => {
    setIsDownloading(true);
    const zip = new JSZip();
    const newProgress = {};
    let downloadQueue = [...selectedFiles];

    const downloadNextBatch = async () => {
      const activeDownloads = [];

      for (let i = 0; i < CONCURRENT_DOWNLOADS && downloadQueue.length > 0; i++) {
        const file = downloadQueue.shift();
        activeDownloads.push(downloadFile(file, zip, newProgress));
      }

      await Promise.all(activeDownloads);

      if (downloadQueue.length > 0) {
        await downloadNextBatch();
      }
    };

    try {
      await downloadNextBatch();

      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      const url = URL.createObjectURL(content);
      a.href = url;
      a.download = "novels.zip";
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError("Failed to download selected files: " + err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const retryFetchFiles = () => {
    setError(null);
    setChildren([]);
    fetchFiles();
  };

  if (loading) {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-neutral p-8 rounded-lg w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Loading files from MEGA...</h2>
          <p className="text-sm text-gray-500">Please wait while we fetch the files.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-red-600 text-white p-8 rounded-lg w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Error: {error}</h2>
          <button onClick={retryFetchFiles} className="btn btn-primary mt-4">
            Retry
          </button>
          <button onClick={onClose} className="btn btn-secondary mt-4">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-gray-800 bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-neutral p-8 rounded-lg w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 hover:text-white"
        >
          ✕
        </button>
        <h2 className="text-xl font-semibold mb-4">Download Options</h2>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleSelectAllChange}
            className="text-sm text-gray-300 hover:text-white"
          >
            {selectedFiles.length === children.length ? "Deselect All" : "Select All"}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto mb-4">
          {children.length > 0 ? (
            orderBy(children, (e) => e.name).map((child, index) => (
              <div
                key={index}
                className={`relative flex items-center mb-2 rounded-lg ${
                  selectedFiles.includes(child) ? "bg-base-100" : "bg-transparent"
                }`}
                style={{
                  height: "3rem",
                  transition: "background 0.3s ease",
                }}
              >
                <input
                  type="checkbox"
                  id={`file-${index}`}
                  className="absolute left-2 w-5 h-5 z-10"
                  onChange={() => handleCheckboxChange(child)}
                  checked={selectedFiles.includes(child)}
                />
                <label
                  htmlFor={`file-${index}`}
                  className="text-sm text-gray-300 pl-12 w-full z-10"
                >
                  {child.name}
                </label>
                {progress[child.name] !== undefined && (
                  <div
                    className="absolute top-0 left-0 w-full h-full bg-gray-700 rounded-md"
                    style={{
                      transition: "width 0.3s ease",
                      width: `${progress[child.name]}%`,
                      backgroundColor: "#191E24", // Darker blue from DaisyUI theme
                    }}
                  ></div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-500">No .epub files found in this folder.</p>
          )}
        </div>
        {isDownloading && (
          <div className="w-full h-2 bg-gray-500 rounded mt-4">
            <div
              className="bg-green-600 h-2 rounded"
              style={{
                width: `${totalProgress}%`,
                transition: "width 0.3s ease",
              }}
            ></div>
          </div>
        )}
        <button
          onClick={handleDownloadClick}
          className="btn btn-primary w-full mt-4"
          disabled={selectedFiles.length === 0 || isDownloading}
        >
          {isDownloading ? "Downloading..." : "Download Selected"}
        </button>
      </div>
    </div>
  );
};

export default FullScreenPopup;
