import ResultSubmissionNotice from "@/components/ResultSubmissionNotice";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ResultSubmissionNotice eventId={id}/>;}
