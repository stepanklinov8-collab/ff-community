import EventEditor from "@/components/EventEditor";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EventEditor eventId={id}/>;}
