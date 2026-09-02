import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createAdminClient } from "@/utils/supabase/admin";

interface PushPayload {
  title: string;
  body: string;
  link?: string;
}

function getFirebaseAdminApp() {
  if (getApps().length) return getApp();
  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credentials = rawCredentials
    ? JSON.parse(rawCredentials) as { project_id: string; client_email: string; private_key: string }
    : {
        project_id: process.env.FIREBASE_PROJECT_ID ?? "",
        client_email: process.env.FIREBASE_CLIENT_EMAIL ?? "",
        private_key: process.env.FIREBASE_PRIVATE_KEY ?? "",
      };
  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
    throw new Error("Firebase Admin credentials are not configured");
  }
  return initializeApp({
    credential: cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return { successCount: 0, failureCount: 0 };
  const supabase = createAdminClient();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("token")
    .in("user_id", [...new Set(userIds)])
    .eq("is_active", true);
  if (error) throw error;
  const tokens = [...new Set((subscriptions ?? []).map((item) => item.token).filter(Boolean))];
  if (!tokens.length) return { successCount: 0, failureCount: 0 };

  const result = await getMessaging(getFirebaseAdminApp()).sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: { link: payload.link ?? "/notifications" },
    webpush: {
      notification: { icon: "/brand/omcite-emblem.jpg", badge: "/brand/omcite-emblem.jpg" },
      fcmOptions: { link: payload.link ?? "/notifications" },
    },
  });

  const invalidTokens = result.responses.flatMap((response, index) => {
    const code = response.error?.code ?? "";
    return !response.success && (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token"))
      ? [tokens[index]]
      : [];
  });
  if (invalidTokens.length) {
    await supabase.from("push_subscriptions").update({ is_active: false }).in("token", invalidTokens);
  }
  return { successCount: result.successCount, failureCount: result.failureCount };
}
