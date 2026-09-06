"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA hooks: install prompt + offline detection.
 *
 * Note: SW update detection is intentionally DISABLED. The update banner
 * was annoying users (and on iOS the "waiting worker" logic was unreliable).
 * New versions are picked up automatically on next visit — no user action
 * required.
 */
export function usePWA() {
  const [canInstall, setCanInstall] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Service worker registration — only in production (basePath /vet-heatmap)
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const swUrl = "/vet-heatmap/vetkart-sw.js";
      navigator.serviceWorker
        .register(swUrl, { scope: "/vet-heatmap/" })
        .then((reg) => {
          // Auto-activate any waiting worker silently (no user-facing banner).
          const activateWaiting = () => {
            if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          };
          activateWaiting();
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", activateWaiting);
          });
        })
        .catch((e) => {
          console.warn("[pwa] SW registration failed:", e);
        });

      // When SW activates a NEW version (different from the one that loaded
      // the current page), auto-reload once to pick up the new code.
      // Without this, users see stale UI until they manually refresh.
      // The SW posts SW_ACTIVATED with the new version after activate().
      let hasReloaded = false;
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SW_ACTIVATED" && !hasReloaded) {
          hasReloaded = true;
          // Check if the SW version differs from the page's build version
          const pageVersion = process.env.NEXT_PUBLIC_BUILD_VERSION;
          const swVersion = event.data.version;
          if (pageVersion && swVersion && pageVersion !== swVersion) {
            console.log(`[pwa] SW updated: ${pageVersion} → ${swVersion}, reloading…`);
            // Soft reload — preserves scroll position and form state better
            window.location.reload();
          }
        }
      });
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => {
      setCanInstall(false);
      setInstallEvent(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const promptInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setCanInstall(false);
  };

  return { canInstall, promptInstall, isOffline };
}
