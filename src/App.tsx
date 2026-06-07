import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";
import { useState, useEffect, useRef } from "react";
import { open, message } from "@tauri-apps/plugin-dialog";
import Settings from "./Settings";
import stashLogo from "./assets/Stash_logo2.png";
import "./App.css";

interface QueueItem {
  id: string;
  title: string;
  url: string;
  progress: number;
  timeRemaining: string;
  status: "queued" | "downloading" | "done";
}

interface RecentItem {
  id: string;
  title: string;
  filePath: string;
  format: string;
}

const RECENT_LIMIT = 20;

async function getStore() {
  return await load("stash-recent.json");
}

function App() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("1080p");
  const [format, setFormat] = useState("MP4");
  const [codec, setCodec] = useState("H.264 (Recommended)");
  const [savePath, setSavePath] = useState("~/Downloads/Stash");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [browser, setBrowser] = useState("chrome");
  const [defaultQuality, setDefaultQuality] = useState("1080p");
  const [defaultFormat, setDefaultFormat] = useState("MP4");
  const [defaultCodec, setDefaultCodec] = useState("H.264 (Recommended)");
  const isDownloading = useRef(false);
  const qualityRef = useRef(quality);
  const formatRef = useRef(format);
  const codecRef = useRef(codec);
  const savePathRef = useRef(savePath);
  const browserRef = useRef(browser);
  const queueRef = useRef<QueueItem[]>([]);

  useEffect(() => { qualityRef.current = quality; }, [quality]);
  useEffect(() => { formatRef.current = format; }, [format]);
  useEffect(() => { codecRef.current = codec; }, [codec]);
  useEffect(() => { savePathRef.current = savePath; }, [savePath]);
  useEffect(() => { browserRef.current = browser; }, [browser]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  function getUrlType(u: string): "playlist" | "single" {
    const hasPlaylist = u.includes("list=");
    const hasVideo = u.includes("v=") || u.includes("youtu.be/");
    if (hasPlaylist && !hasVideo) return "playlist";
    return "single";
  }

  function invokeDownload(item: QueueItem) {
    isDownloading.current = true;
    invoke("start_download", {
      id: item.id,
      url: item.url,
      quality: qualityRef.current,
      format: formatRef.current,
      codec: codecRef.current,
      savePath: savePathRef.current,
      browser: browserRef.current,
    });
  }

  function startNextDownload(currentQueue: QueueItem[]) {
    if (isDownloading.current) return;
    const next = currentQueue.find(item => item.status === "queued" && item.url !== "");
    if (!next) return;
    invokeDownload(next);
  }

  // Load recent downloads from disk on startup
  useEffect(() => {
    async function loadRecent() {
      try {
        const store = await getStore();
        const saved = await store.get<RecentItem[]>("recent");
        if (saved && Array.isArray(saved)) setRecent(saved);
        const savedPath = await store.get<string>("savePath");
        if (savedPath) setSavePath(savedPath);
        const savedBrowser = await store.get<string>("browser");
        if (savedBrowser) setBrowser(savedBrowser);
        const savedDefaultQuality = await store.get<string>("defaultQuality");
        if (savedDefaultQuality) { setDefaultQuality(savedDefaultQuality); setQuality(savedDefaultQuality); }
        const savedDefaultFormat = await store.get<string>("defaultFormat");
        if (savedDefaultFormat) { setDefaultFormat(savedDefaultFormat); setFormat(savedDefaultFormat); }
        const savedDefaultCodec = await store.get<string>("defaultCodec");
        if (savedDefaultCodec) { setDefaultCodec(savedDefaultCodec); setCodec(savedDefaultCodec); }
      } catch (e) {
        console.error("Failed to load recent downloads", e);
      } finally {
        setStoreLoaded(true);
      }
    }
    loadRecent();
  }, []);

  useEffect(() => {
    async function saveRecent() {
      try {
        const store = await getStore();
        await store.set("recent", recent);
        await store.save();
      } catch (e) {
        console.error("Failed to save recent downloads", e);
      }
    }
    if (recent.length > 0) saveRecent();
  }, [recent]);

  useEffect(() => {
    if (!storeLoaded || !savePath) return;
    async function saveSavePath() {
      try {
        const store = await getStore();
        await store.set("savePath", savePath);
        await store.save();
      } catch (e) {
        console.error("Failed to save path", e);
      }
    }
    saveSavePath();
  }, [savePath, storeLoaded]);

  useEffect(() => {
    if (!storeLoaded) return;
    async function save() {
      const store = await getStore();
      await store.set("browser", browser);
      await store.save();
    }
    save();
  }, [browser, storeLoaded]);

  useEffect(() => {
    if (!storeLoaded) return;
    async function save() {
      const store = await getStore();
      await store.set("defaultQuality", defaultQuality);
      await store.set("defaultFormat", defaultFormat);
      await store.set("defaultCodec", defaultCodec);
      await store.save();
    }
    save();
  }, [defaultQuality, defaultFormat, defaultCodec, storeLoaded]);

  useEffect(() => {
    const unlistenProgress = listen<{ id: string; progress: number; eta: string }>(
      "download-progress",
      (event) => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === event.payload.id
              ? { ...item, progress: event.payload.progress, timeRemaining: event.payload.eta, status: "downloading" as const }
              : item
          )
        );
      }
    );

    const unlistenTitle = listen<{ id: string; title: string }>(
      "download-title",
      (event) => {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === event.payload.id ? { ...item, title: event.payload.title } : item
          )
        );
      }
    );

    const unlistenComplete = listen<{ id: string; title: string; filePath: string; format: string }>(
      "download-complete",
      (event) => {
        const { id, title, filePath, format } = event.payload;
        setRecent((prev) => {
          const newEntry: RecentItem = { id, title, filePath, format };
          return [newEntry, ...prev.filter((item) => item.id !== id)].slice(0, RECENT_LIMIT);
        });
        isDownloading.current = false;
        setQueue((prev) => {
          const remaining = prev.filter((item) => item.id !== id);
          queueRef.current = remaining;
          setTimeout(() => startNextDownload(remaining), 50);
          return remaining;
        });
      }
    );

    return () => {
      unlistenProgress.then((f) => f());
      unlistenComplete.then((f) => f());
      unlistenTitle.then((f) => f());
    };
  }, []);

  const audioFormats = ["MP3", "AAC", "FLAC", "WAV"];
  const isAudioOnly = audioFormats.includes(format);

  async function handlePickFolder() {
    const selected = await open({ directory: true, multiple: false, title: "Choose download location" });
    if (selected) setSavePath(selected as string);
  }

  async function handleOpenLocation(filePath: string) {
    try {
      await invoke("open_file_location", { filePath });
    } catch {
      await message(
        "This file couldn't be found. It may be on a disconnected drive or was moved or deleted.",
        { title: "File Not Found", kind: "error" }
      );
    }
  }

  async function clearRecent() {
    setRecent([]);
    try {
      const store = await getStore();
      await store.set("recent", []);
      await store.save();
    } catch (e) {
      console.error("Failed to clear recent downloads", e);
    }
  }

  async function handleDownload() {
    if (!url.trim()) return;
    const trimmedUrl = url.trim();
    setUrl("");

    if (getUrlType(trimmedUrl) === "playlist") {
      const fetchingId = Date.now().toString();
      setQueue((prev) => [...prev, {
        id: fetchingId, title: "Fetching playlist...", url: "",
        progress: 0, timeRemaining: "", status: "queued" as const,
      }]);

      try {
        const videos = await invoke<{ title: string; id: string }[]>("fetch_playlist", { url: trimmedUrl, browser: browserRef.current });
        const playlistItems: QueueItem[] = videos.map((video, i) => ({
          id: `${Date.now()}-${i}`,
          title: video.title,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          progress: 0, timeRemaining: "", status: "queued" as const,
        }));

        setQueue((prev) => {
          const without = prev.filter((item) => item.id !== fetchingId);
          const updated = [...without, ...playlistItems];
          queueRef.current = updated;
          return updated;
        });

        setTimeout(() => {
          if (!isDownloading.current) startNextDownload(queueRef.current);
        }, 100);

      } catch (e) {
        setQueue((prev) => prev.filter((item) => item.id !== fetchingId));
        console.error("Failed to fetch playlist", e);
      }

    } else {
      const id = Date.now().toString();
      const newItem: QueueItem = {
        id,
        title: "Fetching info...",
        url: trimmedUrl,
        progress: 0,
        timeRemaining: "",
        status: "queued",
      };
      const updatedQueue = [...queueRef.current, newItem];
      queueRef.current = updatedQueue;
      setQueue(updatedQueue);

      invoke<string>("fetch_title", { url: trimmedUrl, browser: browserRef.current })
        .then((title) => {
          if (title) {
            setQueue((prev) =>
              prev.map((item) => item.id === id ? { ...item, title } : item)
            );
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!isDownloading.current) {
            invokeDownload(newItem);
          }
        });
    }
  }

  if (showSettings) {
    return (
      <Settings
        browser={browser}
        setBrowser={setBrowser}
        defaultQuality={defaultQuality}
        setDefaultQuality={(v) => { setDefaultQuality(v); setQuality(v); }}
        defaultFormat={defaultFormat}
        setDefaultFormat={(v) => { setDefaultFormat(v); setFormat(v); }}
        defaultCodec={defaultCodec}
        setDefaultCodec={(v) => { setDefaultCodec(v); setCodec(v); }}
        onBack={() => setShowSettings(false)}
      />
    );
  }

  return (
    <div className="app">
      <div className="titlebar">
        <div className="titlebar-spacer" />
        <img src={stashLogo} alt="Stash" className="titlebar-logo-img" />
        <div className="titlebar-right">
          <button className="gear-btn" onClick={() => setShowSettings(true)} aria-label="Settings">⚙️</button>
        </div>
      </div>

      <div className="topbar">
        <select className="tb-control tb-select" value={quality} onChange={(e) => setQuality(e.target.value)} aria-label="Quality">
          <option>4K</option>
          <option>1080p</option>
          <option>720p</option>
          <option>480p</option>
          <option>360p</option>
          <option>Audio only</option>
        </select>

        <input
          className="tb-control tb-url"
          type="text"
          placeholder="Paste a video link here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleDownload()}
          aria-label="Video URL"
        />

        <select
          className={`tb-control tb-select ${isAudioOnly ? "tb-disabled" : ""}`}
          value={codec}
          onChange={(e) => setCodec(e.target.value)}
          disabled={isAudioOnly}
          aria-label="Codec"
        >
          <option>H.264 (Recommended)</option>
          <option>H.265 / HEVC</option>
          <option>AV1</option>
          <option>VP9</option>
          <option>Best Available</option>
        </select>

        <select className="tb-control tb-select" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="File format">
          <option>MP4</option>
          <option>MKV</option>
          <option>MOV</option>
          <option>WEBM</option>
          <option>MP3</option>
          <option>AAC</option>
          <option>FLAC</option>
          <option>WAV</option>
        </select>

        <button className="tb-control tb-btn" onClick={handleDownload} aria-label="Start download">
          ↓ Download
        </button>
      </div>

      <div className="body">
        <div className="left">
          <div className="section">
            <div className="section-label">Save Location</div>
            <div className="filepath">
              <button className="folder-btn" onClick={handlePickFolder} aria-label="Choose folder">🗂</button>
              <div className="path-display">{savePath}</div>
            </div>
          </div>

          <div className="section">
            <div className="section-label">Queue & Progress</div>
            <div className="queue">
              {queue.map((item) => (
                <div key={item.id} className={`q-item ${item.status === "queued" ? "q-item--queued" : ""}`}>
                  <div className="q-meta">
                    <span className="q-name">{item.title}</span>
                    <span className="q-status">{item.status === "queued" ? "Queued" : item.timeRemaining}</span>
                  </div>
                  <div className="q-track">
                    {item.status === "queued" ? (
                      <span className="q-waiting">Waiting...</span>
                    ) : (
                      <div className="q-fill" style={{ width: `${item.progress}%` }}>
                        <span className="q-pct">{item.progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="right">
          <div className="recent-header">
            <div className="section-label">Recent Downloads</div>
            {recent.length > 0 && (
              <button className="clear-recent-btn" onClick={clearRecent}>
                Clear
              </button>
            )}
          </div>
          <div className="recent-list">
            {recent.map((item) => (
              <div key={item.id} className="r-item">
                <button className="r-folder" onClick={() => handleOpenLocation(item.filePath)} aria-label="Open file location">🗂</button>
                <div className="r-info">
                  <div className="r-name">{item.title}</div>
                  <div className="r-path">{item.filePath}</div>
                </div>
                <div className="r-ext">{item.format}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;