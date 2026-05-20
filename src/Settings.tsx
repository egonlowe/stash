import "./Settings.css";

interface SettingsProps {
  browser: string;
  setBrowser: (v: string) => void;
  defaultQuality: string;
  setDefaultQuality: (v: string) => void;
  defaultFormat: string;
  setDefaultFormat: (v: string) => void;
  defaultCodec: string;
  setDefaultCodec: (v: string) => void;
  onBack: () => void;
}

function Settings({ browser, setBrowser, defaultQuality, setDefaultQuality, defaultFormat, setDefaultFormat, defaultCodec, setDefaultCodec, onBack }: SettingsProps) {
  return (
    <div className="app">
      <div className="titlebar">
        <button className="back-btn" onClick={onBack} aria-label="Back">←</button>
        <span className="logo">St<span className="logo-a">▶</span>sh</span>
        <div className="titlebar-spacer" />
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Browser</div>
          <div className="settings-section-desc">Stash uses your browser's YouTube login to download videos. Select the browser you use for YouTube.</div>
          <select className="settings-select" value={browser} onChange={(e) => setBrowser(e.target.value)}>
            <option value="chrome">Chrome</option>
            <option value="safari">Safari</option>
            <option value="firefox">Firefox</option>
            <option value="brave">Brave</option>
            <option value="edge">Edge</option>
            <option value="opera">Opera</option>
            <option value="opera-gx">Opera GX</option>
          </select>
        </div>

        <div className="settings-divider" />

        <div className="settings-section">
          <div className="settings-section-title">Default Quality</div>
          <div className="settings-section-desc">The quality pre-selected when Stash opens.</div>
          <select className="settings-select" value={defaultQuality} onChange={(e) => setDefaultQuality(e.target.value)}>
            <option>4K</option>
            <option>1080p</option>
            <option>720p</option>
            <option>480p</option>
            <option>360p</option>
            <option>Audio only</option>
          </select>
        </div>

        <div className="settings-divider" />

        <div className="settings-section">
          <div className="settings-section-title">Default Format</div>
          <div className="settings-section-desc">The file format pre-selected when Stash opens.</div>
          <select className="settings-select" value={defaultFormat} onChange={(e) => setDefaultFormat(e.target.value)}>
            <option>MP4</option>
            <option>MKV</option>
            <option>MOV</option>
            <option>WEBM</option>
            <option>MP3</option>
            <option>AAC</option>
            <option>FLAC</option>
            <option>WAV</option>
          </select>
        </div>

        <div className="settings-divider" />

        <div className="settings-section">
          <div className="settings-section-title">Default Codec</div>
          <div className="settings-section-desc">The codec pre-selected when Stash opens. H.264 is recommended for maximum compatibility.</div>
          <select className="settings-select" value={defaultCodec} onChange={(e) => setDefaultCodec(e.target.value)}>
            <option>H.264 (Recommended)</option>
            <option>H.265 / HEVC</option>
            <option>AV1</option>
            <option>VP9</option>
            <option>Best Available</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default Settings;
