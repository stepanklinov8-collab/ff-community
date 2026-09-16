import { z } from "zod";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { authErrorMessage } from "@/utils/auth/email-flow";

const confirmationSchema = z.object({
  tokenHash: z.string().min(1).max(512),
  type: z.enum(["signup", "recovery"]),
});

// Only an explicit button press consumes the token. Email scanners can safely GET the page.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Откройте ссылку подтверждения на сайте." }, { status: 403 });
  }
  try {
    const { tokenHash, type } = confirmationSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data.session) {
      return Response.json({ error: error ? authErrorMessage(error) : "Ссылка недействительна. Запросите новое письмо." }, {
        status: error?.status === 429 ? 429 : 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof z.ZodError ? "Ссылка некорректна. Запросите новое письмо." : "Не удалось подтвердить запрос. Попробуйте ещё раз." }, {
      status: error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
