import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";

const logSchema = z.object({
  outcome: z.enum(["success", "error"]),
  code: z.string().trim().min(1).max(80),
  emailDomain: z.string().trim().toLowerCase().max(120),
});

export async function POST(request: Request) {
  try {
    const payload = logSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { error } = await supabase.from("registration_attempt_logs").insert({
      outcome: payload.outcome,
      error_code: payload.code,
      email_domain: payload.emailDomain || null,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) || null,
    });
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (!(error instanceof z.ZodError)) console.error("Registration log error", error);
    return Response.json({ success: false }, { status: 400 });
  }
}
