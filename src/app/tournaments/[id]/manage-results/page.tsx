"use client";
import {useParams} from "next/navigation";
import CompetitionResultsEditor from "@/components/CompetitionResultsEditor";
export default function Page(){const {id}=useParams<{id:string}>();return <CompetitionResultsEditor eventId={id}/>;}
