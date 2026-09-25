import {z} from "zod";
import {warningInputSchema} from "./model";
const id=z.string().uuid(),reason=z.string().trim().min(1).max(1000);
export const moderationAction=z.discriminatedUnion("action",[
 z.object({action:z.literal("issue_warning"),sessionId:id.nullable(),warning:warningInputSchema.extend({category:z.enum(["event","chat"])})}),
 z.object({action:z.literal("cancel_warning"),id,reason}),
 z.object({action:z.literal("lift_sanction"),id}),
 z.object({action:z.literal("sanction"),targetType:z.enum(["player","team"]),targetId:id,reason,endsAt:z.string().datetime().refine(v=>Date.parse(v)>Date.now(),"Срок должен быть в будущем"),scopes:z.array(z.enum(["events","event_comments","public_comments","chat"])).min(1)}),
 z.object({action:z.literal("blacklist_add"),organizerId:id.nullable(),targetType:z.enum(["player","team"]),targetId:id,eventId:id.nullable(),reason:z.string().trim().max(1000),expiresAt:z.string().datetime().nullable()}),
 z.object({action:z.literal("blacklist_remove"),id}),
 z.object({action:z.literal("appeal"),sourceType:z.enum(["warning","sanction","blacklist"]),sourceId:id,recipientId:id,message:z.string().trim().min(1).max(10000),evidence:z.array(z.string().url().refine(s=>s.startsWith("https://"),"Нужна HTTPS-ссылка")).max(10)}),
 z.object({action:z.literal("decide_appeal"),id,approve:z.boolean(),answer:z.string().trim().min(1).max(10000),cancelWarning:z.boolean(),liftSanction:z.boolean()}),
]);
export const organizerAction=z.discriminatedUnion("action",[
 z.object({action:z.literal("apply"),message:z.string().trim().min(1).max(5000)}),
 z.object({action:z.literal("review"),userId:id,status:z.enum(["approved","rejected","suspended","revoked"])}),
]);
export function warningState(w:{cancelled_at?:string|null;used_in_sanction?:string|null;expires_at?:string|null;activated_at?:string|null},now=Date.now()){
 return w.cancelled_at?"cancelled":w.used_in_sanction?"used":w.expires_at&&Date.parse(w.expires_at)<=now?"expired":!w.activated_at?"draft":"active";
}
