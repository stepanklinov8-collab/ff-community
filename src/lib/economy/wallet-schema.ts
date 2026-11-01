import { z } from "zod";
const amount = z.number().int().positive().max(1_000_000_000_000);
const reason = z.string().trim().min(3, "Укажите причину").max(1000);
const teamId = z.string().uuid().optional();
export const walletActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("transfer"), userId: z.string().uuid().optional(), recipientTeamId: z.string().uuid().optional(), amount, teamId }).strict()
    .refine(value => Number(!!value.userId) + Number(!!value.recipientTeamId) === 1, "Выберите одного получателя: игрока или организацию"),
  z.object({ action: z.literal("withdraw_request"), amount, teamId, note: z.string().trim().min(3, "Укажите реквизиты").max(2000) }).strict(),
  z.object({ action: z.literal("withdraw_cancel"), withdrawalId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("withdraw_paid"), withdrawalId: z.string().uuid(), reason }).strict(),
  z.object({ action: z.literal("withdraw_reject"), withdrawalId: z.string().uuid(), reason }).strict(),
  z.object({ action: z.literal("adjust"), kind: z.enum(["player", "organization"]), ownerId: z.string().uuid(), amount: z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000).refine(n => n !== 0), reason }).strict(),
  z.object({ action: z.literal("reset"), kind: z.enum(["player", "organization"]), ownerId: z.string().uuid(), reason }).strict(),
  z.object({ action: z.literal("reverse"), operationId: z.string().uuid(), reason }).strict(),
  z.object({ action: z.literal("permission"), userId: z.string().uuid(), enabled: z.boolean() }).strict(),
]);
export const walletRequestSchema = z.object({ requestId: z.string().uuid(), operation: walletActionSchema }).strict();
