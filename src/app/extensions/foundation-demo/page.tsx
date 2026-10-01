import { ModulePage } from "@/modules/foundation-demo/public";
import { requireModulePage } from "@/platform/module-access";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ fault?: string }> }) {
  await requireModulePage("foundation-demo");
  // Fault injection exists only in the isolated test build, never in production.
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === "test" && (await searchParams).fault === "render") throw new Error("Isolated module failure");
  return <ModulePage />;
}
