import {z} from "zod";
const uuid=z.string().uuid(),coins=z.number().int().min(0).max(1_000_000_000_000),sequence=z.string().regex(/^\d{1,18}$/);
const identity={requestId:uuid,dealId:uuid};
export const marketMutationSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("save"),...identity,expectedRevision:z.number().int().min(0).max(1_000_000),organizationId:uuid,buyerUserId:uuid.nullable(),buyerOrganizationId:uuid.nullable(),price:coins,expiresAt:z.string().datetime({offset:true})}).strict().refine(value=>(value.buyerUserId===null)!==(value.buyerOrganizationId===null),"Выберите одного покупателя"),
 ...(["offer","disclose","seller_accept","buyer_fund","complete","cancel","reject"] as const).map(action=>z.object({action:z.literal(action),...identity,revision:z.number().int().positive()}).strict()),
 ...(["dispute","resolve","reverse"] as const).map(action=>z.object({action:z.literal(action),...identity,revision:z.number().int().positive(),reason:z.string().trim().min(3).max(1000)}).strict()),
 z.object({action:z.literal("message"),...identity,body:z.string().trim().min(1).max(4000),replyTo:sequence.nullable()}).strict(),
 z.object({action:z.literal("read"),...identity,lastSeen:sequence}).strict(),
]);
export type MarketMutation=z.infer<typeof marketMutationSchema>;
export const marketQuerySchema=z.object({dealId:uuid.optional(),revision:z.coerce.number().int().positive().optional(),offset:z.coerce.number().int().min(0).max(1_000_000).default(0),
 search:z.string().trim().min(2).max(80).optional(),searchKind:z.enum(["organizations","users"]).optional(),chat:z.literal("true").optional(),before:sequence.optional(),history:z.literal("true").optional(),events:z.literal("true").optional(),
}).strict().superRefine((value,ctx)=>{
 if(value.search&&(!value.searchKind||value.dealId||value.chat||value.history||value.events||value.revision||value.before))ctx.addIssue({code:"custom",message:"Поиск выполняется отдельно от сделки"});
 if(!value.search&&value.searchKind)ctx.addIssue({code:"custom",message:"Укажите строку поиска"});
 if((value.chat||value.history||value.events||value.revision)&&!value.dealId)ctx.addIssue({code:"custom",message:"Выберите сделку"});
 if([value.chat,value.history,value.events].filter(Boolean).length>1||value.before&&!value.chat)ctx.addIssue({code:"custom",message:"Переписка и история загружаются отдельно"});
});
export const marketStatus:Record<string,string>={draft:"Черновик",offered:"На согласовании",funded:"Цена зарезервирована",completed:"Покупка завершена",cancelled:"Отозвано",rejected:"Отклонено",expired:"Срок истёк",superseded:"Заменено новой редакцией",reversed:"Отменено администрацией"};
