import {z} from "zod";
const coins=z.number().int().min(0).max(1_000_000_000_000);
const percent={basisPoints:z.number().int().min(0).max(10000),basis:z.enum(["organization_prizes","player_payments"])};
export const rentalCompensationSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("none")}).strict(),
 z.object({kind:z.literal("fixed"),amount:coins}).strict(),
 z.object({kind:z.literal("percent"),...percent}).strict(),
 z.object({kind:z.literal("combined"),amount:coins,...percent,selection:z.enum(["maximum","minimum"])}).strict(),
]);
export const rentalConditionSchema=z.object({organizationId:z.string().uuid(),compensation:rentalCompensationSchema}).strict();
export type RentalCompensation=z.infer<typeof rentalCompensationSchema>;
export type RentalCondition=z.infer<typeof rentalConditionSchema>;
export const rentalBasisLabels={organization_prizes:"Призовые организации за выступление",player_payments:"Фактические выплаты игроку по аренде"};
export function rentalCompensationAmount(input:unknown,organizationPrizes:bigint,playerPayments:bigint):bigint{
 if(organizationPrizes<BigInt(0)||playerPayments<BigInt(0))throw new Error("Основание компенсации не может быть отрицательным");
 const rule=rentalCompensationSchema.parse(input);
 if(rule.kind==="none")return BigInt(0);
 if(rule.kind==="fixed")return BigInt(rule.amount);
 const base=rule.basis==="organization_prizes"?organizationPrizes:playerPayments;
 const value=base*BigInt(rule.basisPoints)/BigInt(10000);
 if(rule.kind==="percent")return value;
 return rule.selection==="maximum"?(value>BigInt(rule.amount)?value:BigInt(rule.amount)):(value<BigInt(rule.amount)?value:BigInt(rule.amount));
}
export function describeRentalCompensation(input:unknown):string{
 const fee=rentalCompensationSchema.parse(input),number=(amount:number)=>amount.toLocaleString("ru-RU");
 const payer="Оплачивает нанявшая организация со своего счёта; выплата игроку не уменьшается.";
 if(fee.kind==="none")return "Компенсация основной организации не предусмотрена.";
 if(fee.kind==="fixed")return `${number(fee.amount)} OC. ${payer}`;
 const percentage=`${number(fee.basisPoints/100)}%: ${rentalBasisLabels[fee.basis].toLowerCase()}`;
 return `${fee.kind==="percent"?percentage:`${fee.selection==="maximum"?"Большее":"Меньшее"} из ${number(fee.amount)} OC и ${percentage}`}. Процент округляется вниз до целой монеты. ${payer}`;
}
