import { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { load } from "@tauri-apps/plugin-store";
import App from "./App";
import Splash from "./Splash";
import Setup from "./Setup";

function Root() {
  const [showSplash, setShowSplash] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const store = await load("stash-recent.json");
        const savedBrowser = await store.get<string>("browser");
        setNeedsSetup(!savedBrowser);
      } catch (e) {
        console.error("Failed to check setup state", e);
      } finally {
        setSetupChecked(true);
      }
    }
    checkSetup();
  }, []);

  if (showSplash) {
    return <Splash onFinished={() => setShowSplash(false)} />;
  }
  if (!setupChecked) {
    return null;
  }
  if (needsSetup) {
    return <Setup onFinished={() => setNeedsSetup(false)} />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <Root />
);
