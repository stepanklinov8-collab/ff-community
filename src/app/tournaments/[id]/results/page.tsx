import PublicCompetitionResults from "@/components/PublicCompetitionResults";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PublicCompetitionResults eventId={id}/>;}
