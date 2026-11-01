import {Suspense} from "react";
import {TransfersPage} from "@/modules/contracts/public";
import {requireModulePage} from "@/platform/module-access";
export const dynamic="force-dynamic";
export default async function Page(){await requireModulePage("contracts");return <Suspense fallback={<p role="status">Загрузка переходов…</p>}><TransfersPage/></Suspense>;}
