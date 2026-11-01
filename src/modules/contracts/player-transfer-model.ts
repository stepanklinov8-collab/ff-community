import {z} from "zod";
import {contractTermsSchema} from "./model.ts";
import {marketQuerySchema} from "./market-model.ts";
import {cancellationReasons} from "./transfer-cancellation.ts";
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
const identity={requestId:uuid,dealId:uuid,revision:z.number().int().positive()};
export const playerTransferMutationSchema=z.discriminatedUnion("action",[
 playerTransferDraftSchema,
 ...(["offer","player_consent","prepare_contract","buyer_fund","complete","cancel","reject"] as const).map(action=>z.object({action:z.literal(action),...identity}).strict()),
 z.object({action:z.literal("home_consent"),...identity,homeContractId:uuid,approve:z.boolean()}).strict(),
 z.object({action:z.literal("disclose"),...identity,organizationId:uuid}).strict(),
 ...(["dispute","resolve"] as const).map(action=>z.object({action:z.literal(action),...identity,reason:z.string().trim().min(3).max(1000)}).strict()),
 z.object({action:z.literal("reverse_review"),...identity,cause:z.enum(cancellationReasons),reason:z.string().trim().min(3).max(1000)}).strict(),
 z.object({action:z.literal("reverse_consent"),...identity,proposalId:uuid,party:z.enum(["player","organization","buyer","previous"])}).strict(),
 z.object({action:z.literal("reverse_complete"),...identity,proposalId:uuid}).strict(),
 z.object({action:z.literal("message"),requestId:uuid,dealId:uuid,body:z.string().trim().min(1).max(4000),replyTo:z.string().regex(/^\d{1,18}$/).nullable()}).strict(),
 z.object({action:z.literal("read"),requestId:uuid,dealId:uuid,lastSeen:z.string().regex(/^\d{1,18}$/)}).strict(),
]);
export const playerTransferQuerySchema=marketQuerySchema;
export type PlayerTransferMutation=z.infer<typeof playerTransferMutationSchema>;
