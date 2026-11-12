import type { NextConfig } from "next";

import { assertDatabaseTarget, deploymentEnvironment } from "./src/platform/environment";
import {backendTransport} from './src/platform/backend-transport';
import { legacySiteHost, publicSiteOrigin, publicSitePaths } from "./src/lib/site-address";

const environment = deploymentEnvironment(process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV);
if (process.env.VERCEL_ENV && process.env.NEXT_PUBLIC_DEPLOYMENT_ENV && process.env.VERCEL_ENV !== process.env.NEXT_PUBLIC_DEPLOYMENT_ENV) throw new Error("Conflicting deployment environments");
assertDatabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, environment);
const mediaEndpoint = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  reactCompiler: true,
  agentRules: false,
  poweredByHeader: false,
  async redirects() {
    if (process.env.OMCITE_LEGACY_REDIRECT !== "1") return [];

    // Keep the legacy host's sign-in and callback URLs usable for existing sessions and emails.
    const uuid = ":id([0-9a-fA-F-]{36})";
    const publicDetails = [
      `/tournaments/${uuid}`,
      `/tournaments/${uuid}/results`,
      `/tournaments/${uuid}/participants`,
      `/teams/${uuid}`,
      `/profile/${uuid}`,
      `/clan-wars/${uuid}`,
      `/clan-wars/${uuid}/results`,
      `/bloggers/${uuid}`,
    ];
    return [...publicSitePaths, ...publicDetails].map(path => ({
      source: path,
      has: [{ type: "host" as const, value: legacySiteHost.replaceAll(".", "\\.") }],
      destination: `${publicSiteOrigin}${path.replace(uuid, ":id")}`,
      statusCode: 301,
    }));
  },
  ...(environment === "test" ? { experimental: { cpus: 2 } } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.wildflamestudio.com" },
      ...(mediaEndpoint?.protocol === "https:" ? ["avatars", "event-images"].map(bucket =>
        new URL(`/storage/v1/object/public/${bucket}/**`, mediaEndpoint)
      ) : []),
    ],
  },
  env: { NEXT_PUBLIC_DEPLOYMENT_ENV: environment, NEXT_PUBLIC_SUPABASE_TRANSPORT:backendTransport(process.env.NEXT_PUBLIC_SUPABASE_TRANSPORT || (environment==='preview'?'proxy':'direct')) },
};

export default nextConfig;
