import {z} from "zod";
import {contractTermsSchema} from "./model.ts";
const uuid=z.string().uuid(),coins=z.number().int().min(0).max(1_000_000_000_000);
export const playerTransferDraftSchema=z.object({
 action:z.literal("player_save"),requestId:uuid,dealId:uuid,expectedRevision:z.number().int().min(0).max(1_000_000),
 playerId:uuid,destinationId:uuid,buyerUserId:uuid.nullable(),buyerOrganizationId:uuid.nullable(),price:coins,
 expiresAt:z.string().datetime({offset:true}),newTerms:contractTermsSchema,
 compensationOverrides:z.array(z.object({contractId:uuid,amount:coins}).strict()).max(2),
}).strict().superRefine((value,ctx)=>{
 if((value.buyerUserId===null)===(value.buyerOrganizationId===null))ctx.addIssue({code:"custom",message:"Выберите одного плательщика"});
 if(Date.parse(value.expiresAt)<Date.parse(value.newTerms.startsAt))ctx.addIssue({code:"custom",message:"Срок предложения должен включать начало нового договора"});
 if(value.newTerms.financial.rentalCompensations?.length)ctx.addIssue({code:"custom",message:"Основной договор перехода не является арендой"});
 if(!value.newTerms.financial.transferCancellation)ctx.addIssue({code:"custom",path:["newTerms","financial","transferCancellation"],message:"Согласуйте возврат выплат при отмене перехода"});
 if(new Set(value.compensationOverrides.map(row=>row.contractId)).size!==value.compensationOverrides.length)ctx.addIssue({code:"custom",message:"Компенсация договора повторяется"});
});
export type PlayerTransferDraft=z.infer<typeof playerTransferDraftSchema>;
