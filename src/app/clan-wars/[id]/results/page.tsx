import CompetitionResultsEditor from "@/components/CompetitionResultsEditor";
export default async function ClanWarResultsPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <CompetitionResultsEditor eventId={id} kind="clan-war"/>;}
