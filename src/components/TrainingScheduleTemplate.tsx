"use client";
import {useState} from "react";
import type {EventConfiguration} from "@/lib/competition/event-schema";
import {addTrainingSessions,moscowDate,trainingDates} from "@/lib/competition/training-schedule";
import {eventText} from "@/i18n/event-editor";
import {useLanguage} from "./LanguageProvider";

export default function TrainingScheduleTemplate({config,onChange}:{config:EventConfiguration;onChange:(patch:Partial<EventConfiguration>)=>void}) {
  const {locale}=useLanguage();
  const t=(key:Parameters<typeof eventText>[1])=>eventText(locale,key);
  const [startDate,setStartDate]=useState(()=>moscowDate());
  const date=config.trainingSchedule?.startsOn??startDate;
  return <section className="cyber-card space-y-4 p-5" aria-label={t("trainingTemplate")}>
    <h2 className="text-xl font-bold">{t("trainingTemplate")}</h2>
    <p>{t("trainingTimetable")}</p>
    <p className="text-sm text-white/60">{t("trainingRegistration")}</p>
    <p className="text-sm text-white/60">{t("trainingMapCycle")}</p>
    <label className="grid max-w-xs gap-1 text-sm">{t("trainingStartsOn")}
      <input type="date" required value={date} className="rounded-lg border border-white/20 bg-slate-950 p-2" onChange={e=>{
        setStartDate(e.target.value);
        if(config.trainingSchedule)onChange({trainingSchedule:{enabled:true,startsOn:e.target.value}});
      }}/>
    </label>
    <label className="flex items-center gap-3">
      <input type="checkbox" checked={!!config.trainingSchedule} disabled={!date} onChange={e=>{
        if(e.target.checked)onChange({trainingSchedule:{enabled:true,startsOn:date},sessions:addTrainingSessions(config.sessions,trainingDates(date,config.sessions))});
        else onChange({trainingSchedule:null});
      }}/>
      {t("trainingAuto")}
    </label>
    <p className="text-sm text-white/60">{t("trainingTemplateHelp")}</p>
    {config.trainingSchedule&&<p className="text-sm text-cyan-200">{t("trainingTemplateSave")}</p>}
  </section>;
}
