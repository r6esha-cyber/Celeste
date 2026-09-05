/* ------------------------------------------------------------------
 * pwa.js — registers the service worker and reports when a new build
 * is waiting. Without this, anyone who has installed the app keeps
 * seeing the old version after you deploy.
 * ------------------------------------------------------------------ */

export function registerSW(onUpdateReady) {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      /* Something new arrived while the app was already running. */
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            onUpdateReady(() => {
              sw.postMessage({ type: "SKIP_WAITING" });
            });
          }
        });
      });

      /* A build that was already waiting from a previous visit. */
      if (reg.waiting && navigator.serviceWorker.controller) {
        onUpdateReady(() => reg.waiting.postMessage({ type: "SKIP_WAITING" }));
      }

      /* Check again every half hour for long-lived sessions. */
      setInterval(() => reg.update(), 30 * 60 * 1000);
    }).catch((err) => console.error("SW registration failed", err));

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

/* iOS gives no install prompt, so we detect the situation and explain it. */
export function installState() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return { standalone, isIOS, isSafari };
}
