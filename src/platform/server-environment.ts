import "server-only";
import { assertDatabaseTarget, deploymentEnvironment, externalEffectsAllowed } from "./environment";
export function serverEnvironment() {
  const environment = deploymentEnvironment(process.env.NEXT_PUBLIC_DEPLOYMENT_ENV);
  if (process.env.VERCEL_ENV && environment !== process.env.VERCEL_ENV) throw new Error("Conflicting hosting environment");
  assertDatabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, environment);
  return environment;
}
export function allowExternalEffects() {
  return externalEffectsAllowed(serverEnvironment(), process.env.OMCITE_TEST_EXTERNAL_EFFECTS);
}
