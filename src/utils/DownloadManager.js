import JSZip from "jszip";

export class DownloadManager {
  constructor(options = {}) {
    this.CONCURRENT_DOWNLOADS = options.concurrentDownloads || 2;
    this.SPEED_SAMPLE_SIZE = options.speedSampleSize || 5;
    this.speedHistory = [];
    this.progress = {};
    this.totalProgress = 0;
    this.downloadSpeed = 0;
    this.onProgressUpdate = options.onProgressUpdate || (() => {});
    this.onSpeedUpdate = options.onSpeedUpdate || (() => {});
    this.onError = options.onError || console.error;
  }

  getAverageSpeed(newSpeed) {
    this.speedHistory = [...this.speedHistory, newSpeed].slice(
      -this.SPEED_SAMPLE_SIZE
    );
    return (
      this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length
    );
  }

  async downloadFile(file, zip) {
    const fileName = file.name;
    const fileSize = file.size;
    this.progress[fileName] = 0;

    let lastBytes = 0;
    let lastTime = Date.now();

    const downloadStream = await file.download();
    const chunks = [];

    downloadStream.on("progress", ({ bytesLoaded }) => {
      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      const bytesDiff = bytesLoaded - lastBytes;

      if (timeDiff > 0.1) {
        const currentSpeed = bytesDiff / timeDiff;
        const avgSpeed = this.getAverageSpeed(currentSpeed);
        this.onSpeedUpdate(avgSpeed);

        lastBytes = bytesLoaded;
        lastTime = now;
      }

      this.progress[fileName] = (bytesLoaded / fileSize) * 100;
      this.onProgressUpdate(this.progress);
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
  }

  generateSimpleHash() {
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    let hash = "";
    for (let i = 0; i < 4; i++) {
      hash += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return hash;
  }

  async downloadFiles(files, seriesName) {
    this.progress = {};
    this.speedHistory = [];
    const zip = new JSZip();
    let downloadQueue = [...files];

    const downloadNextBatch = async () => {
      const activeDownloads = [];

      for (
        let i = 0;
        i < this.CONCURRENT_DOWNLOADS && downloadQueue.length > 0;
        i++
      ) {
        const file = downloadQueue.shift();
        activeDownloads.push(this.downloadFile(file, zip));
      }

      await Promise.all(activeDownloads);

      if (downloadQueue.length > 0) {
        await downloadNextBatch();
      }
    };

    try {
      await downloadNextBatch();
      const content = await zip.generateAsync({ type: "blob" });
      const hash = this.generateSimpleHash();
      return {
        blob: content,
        filename: `${seriesName} - ${hash}.zip`,
      };
    } catch (err) {
      this.onError(err);
      throw err;
    }
  }
}
