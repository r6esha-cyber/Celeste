import React, { useEffect, useState } from "react";
import { registerSW, installState } from "./pwa";

/* Both banners live outside App.jsx so the app component stays untouched. */

const CSS = `
.ora-banner{position:fixed;left:0;right:0;bottom:0;z-index:200;display:flex;justify-content:center;
  padding:0 14px calc(14px + env(safe-area-inset-bottom));pointer-events:none;
  font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;}
.ora-banner-inner{pointer-events:auto;width:100%;max-width:402px;background:#fff;border-radius:18px;
  padding:15px 16px;box-shadow:0 8px 30px rgba(56,32,44,.22);display:flex;align-items:center;gap:12px;
  animation:oraBannerUp .3s cubic-bezier(.2,.8,.3,1);}
@keyframes oraBannerUp{from{transform:translateY(120%);opacity:0;}to{transform:none;opacity:1;}}
.ora-banner-text{flex:1;min-width:0;}
.ora-banner-title{font-size:13.5px;font-weight:600;color:#38202c;}
.ora-banner-sub{font-size:11.5px;color:#8d6b79;margin-top:3px;line-height:1.45;}
.ora-banner-btn{flex:none;background:#c54b8c;color:#fff;border:none;border-radius:11px;padding:10px 14px;
  font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;}
.ora-banner-x{flex:none;width:28px;height:28px;border-radius:50%;background:#f3e3ea;color:#8d6b79;
  border:none;cursor:pointer;font-size:12px;line-height:1;}
.ora-share{display:inline-grid;place-items:center;width:17px;height:17px;vertical-align:-3px;margin:0 2px;}
@media (prefers-color-scheme: dark){
  .ora-banner-inner{background:#26172b;}
  .ora-banner-title{color:#f6e8ef;}
  .ora-banner-x{background:#372345;}
}
`;

function ShareGlyph() {
  return (
    <span className="ora-share">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M12 3.5v11M12 3.5 8.6 7M12 3.5 15.4 7" stroke="#c54b8c" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 11H4.8v9.2h14.4V11H18" stroke="#c54b8c" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function Prompts() {
  const [update, setUpdate] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    registerSW((apply) => setUpdate(() => apply));

    const { standalone, isIOS, isSafari } = installState();
    const dismissed = localStorage.getItem("celeste:install-dismissed");

    /* Android and desktop Chrome give us a real prompt to fire. */
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      if (!standalone && !dismissed) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    /* iOS has no prompt, so after a short delay we explain the manual step. */
    if (isIOS && isSafari && !standalone && !dismissed) {
      const t = setTimeout(() => setShowInstall(true), 20000);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem("celeste:install-dismissed", "1");
    setShowInstall(false);
  };

  if (update) {
    return (
      <>
        <style>{CSS}</style>
        <div className="ora-banner">
          <div className="ora-banner-inner">
            <div className="ora-banner-text">
              <div className="ora-banner-title">A new version is ready</div>
              <div className="ora-banner-sub">Nothing you have logged will be lost.</div>
            </div>
            <button className="ora-banner-btn" onClick={() => update()}>Reload</button>
          </div>
        </div>
      </>
    );
  }

  if (!showInstall) return null;
  const { isIOS } = installState();

  return (
    <>
      <style>{CSS}</style>
      <div className="ora-banner">
        <div className="ora-banner-inner">
          <div className="ora-banner-text">
            <div className="ora-banner-title">Add Celeste to your home screen</div>
            <div className="ora-banner-sub">
              {isIOS
                ? <>Tap<ShareGlyph />then <strong>Add to Home Screen</strong>. Reminders only work once it is installed.</>
                : "Installs like an app, works offline, and can send reminders."}
            </div>
          </div>
          {!isIOS && deferred && (
            <button className="ora-banner-btn" onClick={async () => {
              deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
              dismiss();
            }}>Install</button>
          )}
          <button className="ora-banner-x" onClick={dismiss} aria-label="Dismiss">✕</button>
        </div>
      </div>
    </>
  );
}
