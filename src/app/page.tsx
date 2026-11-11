import { connection } from "next/server";
import { Suspense } from "react";
import HomeContent from "@/components/HomeContent";
import { getHomeSummary } from "@/lib/home/server";

async function HomeSummary() {
  // Render data on the server at request time; avoid querying a live database
  // during builds. The shared public summary is cached separately for 30 seconds.
  await connection();
  let summary = null;
  try { summary = await getHomeSummary(); }
  catch (error) { console.error("Public home summary unavailable", error); }
  return <HomeContent initialData={summary} />;
}

export default function Home() {
  return <Suspense fallback={<HomeContent initialData={null} pending />}>
    <HomeSummary />
  </Suspense>;
}
