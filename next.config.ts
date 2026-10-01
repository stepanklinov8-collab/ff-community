import type { NextConfig } from "next";

import { assertDatabaseTarget, deploymentEnvironment } from "./src/platform/environment";

const environment = deploymentEnvironment(process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_DEPLOYMENT_ENV);
if (process.env.VERCEL_ENV && process.env.NEXT_PUBLIC_DEPLOYMENT_ENV && process.env.VERCEL_ENV !== process.env.NEXT_PUBLIC_DEPLOYMENT_ENV) throw new Error("Conflicting deployment environments");
assertDatabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, environment);

const nextConfig: NextConfig = {
  reactCompiler: true,
  agentRules: false,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_DEPLOYMENT_ENV: environment },
};

export default nextConfig;
