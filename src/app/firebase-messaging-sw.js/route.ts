export const dynamic = "force-dynamic";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const configured = Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId);
  const script = configured ? `
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/notifications";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.includes(link));
    return existing ? existing.focus() : clients.openWindow(link);
  }));
});
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const title = payload.data?.title || "Новое уведомление";
  self.registration.showNotification(title, {
    body: payload.data?.body || "Откройте OMCITE Arena, чтобы узнать подробности",
    icon: "/brand/omcite-emblem.jpg",
    badge: "/brand/omcite-emblem.jpg",
    data: { link: payload.data?.link || "/notifications" }
  });
});
` : `self.addEventListener("install", () => self.skipWaiting());`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}
