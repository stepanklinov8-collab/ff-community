import { createBrowserClient } from "@supabase/ssr";

import { assertDatabaseTarget, deploymentEnvironment } from "@/platform/environment";
import {createBackendFetch} from '@/platform/backend-fetch';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  assertDatabaseTarget(SUPABASE_URL, deploymentEnvironment(process.env.NEXT_PUBLIC_DEPLOYMENT_ENV));
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {global:{fetch:createBackendFetch(SUPABASE_URL)}});
}
