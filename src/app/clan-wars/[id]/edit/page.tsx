import ClanWarEditor from "@/components/ClanWarEditor";
export default async function Page({params}:{params:Promise<{id:string}>}){return <ClanWarEditor warId={(await params).id}/>;}
