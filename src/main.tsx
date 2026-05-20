import { useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Splash from "./Splash";

function Root() {
  const [showSplash, setShowSplash] = useState(true);
  return showSplash ? <Splash onFinished={() => setShowSplash(false)} /> : <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <Root />
);