import { useEffect } from "react";
import splashLogo from "./assets/SplashLogo.png";
import "./Splash.css";

function Splash({ onFinished }: { onFinished: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinished();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onFinished]);

  return (
    <div className="splash">
      <div className="splash-content">
        <img src={splashLogo} alt="Egon logo" className="splash-logo-img" />
      </div>
      <div className="splash-credit">Designed By Egon</div>
    </div>
  );
}

export default Splash;
