import PublicCompetitionResults from "@/components/PublicCompetitionResults";
import {Suspense} from "react";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Suspense fallback={<p role="status">Загрузка результатов…</p>}><PublicCompetitionResults eventId={id}/></Suspense>;}
