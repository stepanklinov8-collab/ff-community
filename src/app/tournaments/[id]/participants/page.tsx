import RegistrationManager from "@/components/RegistrationManager";
export default async function ParticipantsPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RegistrationManager eventId={id}/>;}
