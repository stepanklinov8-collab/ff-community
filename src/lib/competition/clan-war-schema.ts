import {z} from "zod";
import {maps} from "./model";
export const clanWarConfigurationSchema=z.object({
 creatorTeamId:z.string().uuid(),opponentTeamId:z.string().uuid().nullable(),
 title:z.string().trim().min(2).max(160),description:z.string().trim().max(5000),rules:z.string().trim().max(5000),
 format:z.union([z.literal(4),z.literal(6)]),challengeKind:z.enum(["open","direct"]),scheduledAt:z.string().datetime().nullable(),
 gameCount:z.number().int().positive().max(10000).default(1),winsRequired:z.number().int().positive().max(5000).default(1),maps:z.array(z.enum(maps)).default(["bermuda"]),
 roomCode:z.string().trim().max(100).default(""),roomPassword:z.string().trim().max(100).default(""),roomNote:z.string().trim().max(2000).default(""),commentsClosed:z.boolean().default(false),
}).refine(v=>v.gameCount>=v.winsRequired*2-1&&v.maps.length===v.gameCount,{message:"Укажите карты всех игр и достаточно игр для завершения серии"});
