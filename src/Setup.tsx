import { useState } from "react";
import { load } from "@tauri-apps/plugin-store";
import splashLogo from "./assets/SplashLogo.png";
import "./Setup.css";

function Setup({ onFinished }: { onFinished: () => void }) {
  const [browser, setBrowser] = useState("chrome");
  const [saving, setSaving] = useState(false);

  async function handleGetStarted() {
    if (saving) return;
    setSaving(true);
    try {
      const store = await load("stash-recent.json");
      await store.set("browser", browser);
      await store.save();
      onFinished();
    } catch (e) {
      console.error("Failed to save browser selection", e);
      setSaving(false);
    }
  }

  return (
    <div className="setup">
      <div className="setup-content">
        <img src={splashLogo} alt="Stash" className="setup-logo-img" />
        <div className="setup-title">Welcome to Stash</div>
        <div className="setup-desc">
          Stash uses your browser's YouTube login to access videos.
          Select the browser you use for YouTube to get started.
        </div>
        <select
          className="setup-select"
          value={browser}
          onChange={(e) => setBrowser(e.target.value)}
        >
          <option value="chrome">Chrome</option>
          <option value="safari">Safari</option>
          <option value="firefox">Firefox</option>
          <option value="brave">Brave</option>
          <option value="edge">Edge</option>
          <option value="opera">Opera</option>
          <option value="opera-gx">Opera GX</option>
        </select>
        <button
          className="setup-button"
          onClick={handleGetStarted}
          disabled={saving}
        >
          Get Started
        </button>
      </div>
      <div className="setup-credit">Designed By Egon</div>
    </div>
  );
}

export default Setup;
