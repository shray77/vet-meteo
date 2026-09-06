/**
 * Web Push Notifications module.
 *
 * VAPID keys generated 2026-06-20:
 *   Public:  BFprEJMChpXcZU_hUVtKCsKgGeVNd8BYB50K7_b4H4XU-L2u4y47BCPQ_suQp7FaQsDpxlATSXX8NdhDJ1p9E4Q
 *   Private: 3YqXWLswytMeD9uinUNLaU1mmtju3ovkc2W-pgjjWBc (server-side only)
 *
 * Note: This is a static site (no server). Push notifications require a
 * push service endpoint. For zero-cost, we use the browser's built-in
 * Web Push API which talks to browser-vendor push servers (FCM for Chrome,
 * APNs for Safari, Mozilla's push service for Firefox).
 *
 * Subscription flow:
 *   1. User clicks "Subscribe to alerts"
 *   2. Browser shows permission prompt
 *   3. On grant, we create a PushSubscription with the VAPID public key
 *   4. We store the subscription in localStorage (no server to send to)
 *   5. A GitHub Action would need to read stored subscriptions and send push
 *      — but since we can't store subscriptions without a server, this
 *        module is currently a "local notification" system instead.
 *
 * Workaround for static sites: use the Notifications API directly (no push
 * server needed). The PWA service worker can show notifications when new
 * data is detected during background sync.
 */

export const VAPID_PUBLIC_KEY = "BFprEJMChpXcZU_hUVtKCsKgGeVNd8BYB50K7_b4H4XU-L2u4y47BCPQ_suQp7FaQsDpxlATSXX8NdhDJ1p9E4Q";

/** Check if push notifications are supported. */
export function pushSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/** Get current notification permission. */
export function getPermission(): NotificationPermission {
  if (!pushSupported()) return "denied";
  return Notification.permission;
}

/** Request notification permission. */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  return await Notification.requestPermission();
}

/** Show a local notification (no push server needed). */
export async function showNotification(title: string, options?: NotificationOptions) {
  if (!pushSupported()) return;
  if (Notification.permission !== "granted") return;

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    reg.showNotification(title, {
      icon: "/vet-heatmap/icons/icon-192.png",
      badge: "/vet-heatmap/icons/icon-192.png",
      ...options,
    });
  } else {
    new Notification(title, options);
  }
}

/** Check for new outbreaks since last visit and notify. */
export async function checkForNewOutbreaks(currentCount: number) {
  if (!pushSupported()) return;
  if (Notification.permission !== "granted") return;

  const lastCount = parseInt(localStorage.getItem("lastOutbreakCount") || "0", 10);
  if (lastCount > 0 && currentCount > lastCount) {
    const diff = currentCount - lastCount;
    await showNotification(`Новые вспышки: +${diff}`, {
      body: `Всего вспышек: ${currentCount}. Откройте ВетКарта для деталей.`,
      tag: "new-outbreaks",
      data: { url: "/vet-heatmap/" },
    });
  }
  localStorage.setItem("lastOutbreakCount", String(currentCount));
}
