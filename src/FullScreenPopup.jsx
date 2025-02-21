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
  const [seriesName, setSeriesName] = useState("novel");
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [lastBytesLoaded, setLastBytesLoaded] = useState({});
  const [lastUpdateTime, setLastUpdateTime] = useState({});

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

      // Extract series name from the folder name
      setSeriesName(megaFile.name || "novels");

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

  const formatSpeed = (bytesPerSecond) => {
    if (bytesPerSecond === 0) return '0 B/s';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const unitIndex = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
    const value = bytesPerSecond / Math.pow(1024, unitIndex);
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  const downloadFile = async (file, zip, newProgress) => {
    const fileName = file.name;
    const fileSize = file.size;
    newProgress[fileName] = 0;
    setProgress({ ...newProgress });
    setLastBytesLoaded({ ...lastBytesLoaded, [fileName]: 0 });
    setLastUpdateTime({ ...lastUpdateTime, [fileName]: Date.now() });

    const downloadStream = await file.download();
    const chunks = [];

    downloadStream.on("progress", ({ bytesLoaded }) => {
      const now = Date.now();
      const timeDiff = (now - lastUpdateTime[fileName]) / 1000; // Convert to seconds
      const bytesDiff = bytesLoaded - lastBytesLoaded[fileName];
      const speed = bytesDiff / timeDiff;

      // Update speed if time difference is significant
      if (timeDiff > 0.5) {
        setDownloadSpeed(speed);
        setLastBytesLoaded({ ...lastBytesLoaded, [fileName]: bytesLoaded });
        setLastUpdateTime({ ...lastUpdateTime, [fileName]: now });
      }

      newProgress[fileName] = (bytesLoaded / fileSize) * 100;
      setProgress({ ...newProgress });

      const cumulativeProgress = Object.values(newProgress).reduce(
        (acc, p) => acc + p,
        0
      ) / selectedFiles.length;
      setTotalProgress(cumulativeProgress);
    });

    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }

    const concatenated = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      concatenated.set(new Uint8Array(chunk), offset);
      offset += chunk.length;
    }

    zip.file(fileName, concatenated);
  };

  const generateSimpleHash = () => {
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    let hash = "";
    for (let i = 0; i < 4; i++) {
      hash += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return hash;
  };

  const handleDownloadClick = async () => {
    setIsDownloading(true);
    const zip = new JSZip();
    const newProgress = {};
    let downloadQueue = [...selectedFiles];

    const downloadNextBatch = async () => {
      const activeDownloads = [];

      for (
        let i = 0;
        i < CONCURRENT_DOWNLOADS && downloadQueue.length > 0;
        i++
      ) {
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
      const hash = generateSimpleHash();
      a.download = `${seriesName} - ${hash}.zip`;
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-base-300/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-base-200 p-8 rounded-lg w-full max-w-2xl relative shadow-xl border border-base-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 hover:text-white"
        >
          ✕
        </button>
        <h2 className="text-2xl font-semibold mb-2">{seriesName}</h2>
        <div className="text-xs text-gray-400 mb-4 break-all">
          <span className="font-semibold">MEGA Link:</span>
          <br />
          {decodeURIComponent(selectedUrl)}
        </div>

        <div className="flex items-center justify-between mb-4 bg-base-300/50 p-4 rounded-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSelectAllChange}
              className="btn btn-sm btn-outline"
            >
              {selectedFiles.length === children.length
                ? "Deselect All"
                : "Select All"}
            </button>
            <div className="text-sm">
              <span className="font-semibold">{selectedFiles.length}</span> of
              {" "}
              {children.length} files selected
              {selectedFiles.length > 0 && (
                <span className="ml-2">
                  ({formatFileSize(
                    selectedFiles.reduce((acc, file) => acc + file.size, 0),
                  )})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-h-[calc(100vh-400px)] overflow-y-auto mb-4 bg-base-300/50 rounded-lg">
          {children.length > 0
            ? (
              <div className="divide-y divide-base-content/10">
                {orderBy(children, (e) => e.name).map((child, index) => (
                  <div
                    key={index}
                    className={`relative flex items-center p-3 group ${
                      selectedFiles.includes(child)
                        ? "bg-base-100"
                        : "hover:bg-base-100/50"
                    }`}
                    style={{ transition: "background 0.3s ease" }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        width: progress[child.name]
                          ? `${progress[child.name]}%`
                          : "0%",
                        backgroundColor: "rgba(59, 130, 246, 0.2)",
                        transition: "width 0.3s ease",
                      }}
                    />

                    <input
                      type="checkbox"
                      id={`file-${index}`}
                      className="checkbox checkbox-sm mr-4"
                      onChange={() => handleCheckboxChange(child)}
                      checked={selectedFiles.includes(child)}
                    />

                    <div className="flex-1 z-10">
                      <label
                        htmlFor={`file-${index}`}
                        className="text-sm font-medium cursor-pointer flex items-center justify-between"
                      >
                        <span className="truncate mr-4">{child.name}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatFileSize(child.size)}
                        </span>
                      </label>
                      {progress[child.name] !== undefined && (
                        <div className="text-xs text-gray-400 mt-1">
                          {progress[child.name].toFixed(1)}% downloaded
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
            : (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">📚</div>
                No .epub files found in this folder
              </div>
            )}
        </div>

        {isDownloading && (
          <div className="space-y-2 mb-4">
            <div className="w-full bg-base-300/50 rounded-full h-4 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300 relative"
                style={{ width: `${totalProgress}%` }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-xs text-primary-content font-medium">
                  {totalProgress.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-base-content/70">
              <span>{formatSpeed(downloadSpeed)}</span>
              <span>{formatFileSize(selectedFiles.reduce((acc, file) => acc + file.size, 0))}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleDownloadClick}
          className="btn btn-primary w-full gap-2 shadow-lg"
          disabled={selectedFiles.length === 0 || isDownloading}
        >
          {isDownloading
            ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Downloading {selectedFiles.length} files...
                <span className="text-xs opacity-75">({formatSpeed(downloadSpeed)})</span>
              </>
            )
            : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Download {selectedFiles.length} Selected Files
              </>
            )}
        </button>
      </div>
    </div>
  );
};

export default FullScreenPopup;
