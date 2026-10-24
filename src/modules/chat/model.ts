import { z } from "zod";

const id = z.string().uuid();
const position = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const body = z.string().trim().min(1).max(4000);
const room = { roomId: id };
const message = { ...room, id, version: z.number().int().positive() };
export const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open_support") }).strict(),
  z.object({ action: z.literal("read"), ...room, position }).strict(),
  z.object({ action: z.literal("send"), ...room, id, body, replyTo: id.nullable().default(null),
    notify: z.enum(["none", "admins", "all", "user"]).default("none"), notifyUserId: id.nullable().default(null) }).strict(),
  z.object({ action: z.literal("edit"), ...message, body }).strict(),
  z.object({ action: z.literal("delete"), ...message }).strict(),
  z.object({ action: z.literal("pin"), ...message }).strict(),
  z.object({ action: z.literal("unpin"), ...message }).strict(),
  z.object({ action: z.literal("mute"), ...room, userId: id.nullable(), durationMinutes: z.number().int().min(30).max(5256000).nullable(), reason: z.string().trim().max(500).default("") }).strict(),
  z.object({ action: z.literal("unmute"), ...room, muteId: id }).strict(),
]);
export const querySchema = z.object({
  roomId: id.optional(), before: z.coerce.number().pipe(position).optional(), after: z.coerce.number().pipe(position).optional(),
  cursorTime: z.string().datetime({ offset: true }).optional(), cursorId: id.optional(), summary: z.enum(["true"]).optional(), search: z.string().trim().min(2).max(80).optional(),
}).strict().refine(v => !(v.before !== undefined && v.after !== undefined))
  .refine(v => Boolean(v.cursorTime) === Boolean(v.cursorId));

export interface ChatRoom { id: string; kind: "common" | "support"; ownerId: string | null; nickname: string | null; avatar: string | null; updatedAt: string; unread: boolean }
export interface ChatMessage { id: string; roomId: string; position: number; body: string; version: number; createdAt: string; editedAt: string | null; deleted: boolean; pinned: boolean;
  author: { id: string; nickname: string; avatar: string | null };
  reply: { id: string; nickname: string; body: string; deleted: boolean } | null }
export interface ChatMute { id: string; userId: string | null; nickname: string | null; endsAt: string | null; reason: string }
export interface ChatIndex { userId: string; isAdmin: boolean; rooms: ChatRoom[]; nextCursor: { time: string; id: string } | null; unreadRooms: number }
export interface ChatHistory { messages: ChatMessage[]; pins: ChatMessage[]; mutes: ChatMute[]; canWrite: boolean; lastRead: number; hasOlder: boolean; hasNewer: boolean }
export type ChatMutation = z.infer<typeof mutationSchema>;
