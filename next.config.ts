import type { NextConfig } from "next";

import { assertDatabaseTarget, deploymentEnvironment } from "./src/platform/environment";
import {backendTransport} from './src/platform/backend-transport';

const environment = deploymentEnvironment(process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV);
if (process.env.VERCEL_ENV && process.env.NEXT_PUBLIC_DEPLOYMENT_ENV && process.env.VERCEL_ENV !== process.env.NEXT_PUBLIC_DEPLOYMENT_ENV) throw new Error("Conflicting deployment environments");
assertDatabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, environment);
const mediaEndpoint = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  reactCompiler: true,
  agentRules: false,
  poweredByHeader: false,
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
