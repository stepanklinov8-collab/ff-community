import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";

const requestSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  gameId: z.string().trim().regex(/^\d+$/),
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const supabase = createAdminClient();
    const [nicknameResult, gameIdResult] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("nickname", payload.nickname),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("game_id", payload.gameId),
    ]);
    if (nicknameResult.error) throw nicknameResult.error;
    if (gameIdResult.error) throw gameIdResult.error;

    return Response.json({
      nicknameAvailable: (nicknameResult.count ?? 0) === 0,
      gameIdAvailable: (gameIdResult.count ?? 0) === 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Проверьте ник и Free Fire ID" }, { status: 400 });
    }
    console.error("Identity availability error", error);
    return Response.json({ error: "Не удалось проверить данные. Попробуйте немного позже." }, { status: 500 });
  }
}
