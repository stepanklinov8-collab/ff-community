/** Public project identifiers, never credentials. Unknown remote databases fail closed. */
export const productionProject = "ojtqdfdqicozzqlgjtnm";
export const stagingProject = "swjdbeelqzdleefscuuc";
export type DeploymentEnvironment = "development" | "test" | "preview" | "production";

export function deploymentEnvironment(value: string | undefined): DeploymentEnvironment {
  const environment = value || "development";
  if (!["development", "test", "preview", "production"].includes(environment)) throw new Error("Unknown deployment environment");
  return environment as DeploymentEnvironment;
}
export function assertDatabaseTarget(rawUrl: string | undefined, environment: DeploymentEnvironment) {
  if (!rawUrl) throw new Error("Supabase URL is not configured");
  const url = new URL(rawUrl);
  if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("Invalid Supabase endpoint");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const production = url.origin === `https://${productionProject}.supabase.co`;
  const staging = url.origin === `https://${stagingProject}.supabase.co`;
  if (environment === "production" ? !production : !(staging || local && ["http:", "https:"].includes(url.protocol))) {
    throw new Error("Database/environment mismatch. Development and tests must use a local or staging database.");
  }
  return url.origin;
}
export function assertTestDatabaseTarget(url: string | undefined) {
  return assertDatabaseTarget(url, "test");
}
export function externalEffectsAllowed(environment: DeploymentEnvironment, testOptIn?: string) {
  return environment === "production" || testOptIn === "isolated-test";
}
