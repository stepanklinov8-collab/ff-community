import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createAdminClient } from "@/utils/supabase/admin";
import { deliverPushTokens } from "./delivery";

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
  const users = [...new Set(userIds)], tokens: string[] = [];
  // Chunk filters to keep REST URLs short; one user can have multiple devices.
  for (let offset = 0; offset < users.length; offset += 100) {
    for (let from = 0; ; from += 500) {
      const { data, error } = await supabase.from("push_subscriptions").select("id,token")
        .in("user_id", users.slice(offset, offset + 100)).eq("is_active", true)
        .order("id").range(from, from + 499);
      if (error) throw error;
      tokens.push(...(data ?? []).map(item => item.token));
      if ((data?.length ?? 0) < 500) break;
    }
  }
  if (!tokens.length) return { successCount: 0, failureCount: 0 };

  const result = await deliverPushTokens(tokens, batch => getMessaging(getFirebaseAdminApp()).sendEachForMulticast({
    tokens: batch,
    notification: { title: payload.title, body: payload.body },
    data: { link: payload.link ?? "/notifications" },
    webpush: {
      notification: { icon: "/brand/omcite-emblem.jpg", badge: "/brand/omcite-emblem.jpg" },
      fcmOptions: { link: payload.link ?? "/notifications" },
    },
  }));

  for (let offset = 0; offset < result.invalidTokens.length; offset += 50) {
    const { error } = await supabase.from("push_subscriptions").update({ is_active: false })
      .in("token", result.invalidTokens.slice(offset, offset + 50));
    if (error) console.error("Could not deactivate expired push subscriptions", error.code);
  }
  return { successCount: result.successCount, failureCount: result.failureCount };
}
