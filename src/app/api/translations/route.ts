import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const requestSchema = z.object({
  sourceType: z.enum(["event", "comment", "clan_war", "news", "notification", "contact", "message"]),
  sourceId: z.string().uuid(),
  sourceField: z.string().trim().min(2).max(30),
  targetLocale: z.enum(["ru", "kk", "ky"]),
});

const languageNames = { ru: "Russian", kk: "Kazakh", ky: "Kyrgyz" } as const;

async function readSourceText(
  supabase: ReturnType<typeof createAdminClient>,
  sourceType: z.infer<typeof requestSchema>["sourceType"],
  sourceId: string,
  sourceField: string,
  userId: string,
) {
  if (sourceType === "event") {
    if (!["description"].includes(sourceField)) throw new Error("Unsupported translation field");
    const { data, error } = await supabase.from("events").select("description,is_published").eq("id", sourceId).maybeSingle();
    if (error) throw error;
    if (!data?.is_published) return null;
    return data.description;
  }
  if (sourceType === "comment") {
    if (sourceField !== "body") throw new Error("Unsupported translation field");
    const { data, error } = await supabase.from("comments").select("body,is_deleted").eq("id", sourceId).maybeSingle();
    if (error) throw error;
    return data && !data.is_deleted ? data.body : null;
  }
  if (sourceType === "clan_war") {
    if (!["description", "rules"].includes(sourceField)) throw new Error("Unsupported translation field");
    const { data, error } = await supabase.from("clan_wars").select("description,rules").eq("id", sourceId).maybeSingle();
    if (error) throw error;
    return data?.[sourceField as "description" | "rules"] ?? null;
  }
  if (sourceType === "notification") {
    if (!["title", "body"].includes(sourceField)) throw new Error("Unsupported translation field");
    const { data, error } = await supabase.from("notifications").select("title,body,user_id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data?.[sourceField as "title" | "body"] ?? null;
  }
  if (sourceType === "contact") {
    if (!["role", "description"].includes(sourceField)) throw new Error("Unsupported translation field");
    const { data, error } = await supabase.from("contacts").select("role,description").eq("id", sourceId).maybeSingle();
    if (error) throw error;
    return data?.[sourceField as "role" | "description"] ?? null;
  }
  if (sourceType === "message") {
    if (!["subject", "body"].includes(sourceField)) throw new Error("Unsupported translation field");
    const { data, error } = await supabase.from("messages").select("subject,body,to_user_id").eq("id", sourceId).eq("to_user_id", userId).maybeSingle();
    if (error) throw error;
    return data?.[sourceField as "subject" | "body"] ?? null;
  }
  if (!["title", "excerpt", "content"].includes(sourceField)) throw new Error("Unsupported translation field");
  const { data, error } = await supabase.from("news_posts").select("title,excerpt,content,is_published").eq("id", sourceId).maybeSingle();
  if (error) throw error;
  if (!data?.is_published) return null;
  return data[sourceField as "title" | "excerpt" | "content"] ?? null;
}

async function translateWithProvider(text: string, targetLocale: "kk" | "ky") {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: Math.min(4000, Math.max(200, Math.ceil(text.length * 1.5))),
      text: { verbosity: "low" },
      instructions: `Translate user-authored Free Fire community content into ${languageNames[targetLocale]}. Preserve player nicknames, team names, guild names, tournament names, map names, URLs, numbers, score notation and formatting. Return only the translation without commentary.`,
      input: text,
    }),
  });
  if (!response.ok) throw new Error(`Translation provider failed: ${response.status}`);
  const payload = await response.json() as { output_text?: string };
  return payload.output_text?.trim() || null;
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = requestSchema.parse(await request.json());
    const supabase = createAdminClient();
    const sourceText = await readSourceText(supabase, payload.sourceType, payload.sourceId, payload.sourceField, user.id);
    if (!sourceText?.trim()) return Response.json({ error: "Текст для перевода не найден" }, { status: 404 });
    if (sourceText.length > 10_000) return Response.json({ error: "Текст слишком длинный" }, { status: 400 });
    if (payload.targetLocale === "ru") return Response.json({ translatedText: sourceText, cached: true });

    const sourceHash = createHash("sha256").update(sourceText).digest("hex");
    const { data: cached, error: cacheError } = await supabase.from("content_translations")
      .select("translated_text")
      .eq("source_type", payload.sourceType)
      .eq("source_id", payload.sourceId)
      .eq("source_field", payload.sourceField)
      .eq("source_hash", sourceHash)
      .eq("target_locale", payload.targetLocale)
      .maybeSingle();
    if (cacheError) throw cacheError;
    if (cached) return Response.json({ translatedText: cached.translated_text, cached: true });

    const translatedText = await translateWithProvider(sourceText, payload.targetLocale);
    if (!translatedText) {
      return Response.json({ error: "Сервис перевода ещё не настроен", code: "PROVIDER_NOT_CONFIGURED" }, { status: 503 });
    }
    const { error: insertError } = await supabase.from("content_translations").upsert({
      source_type: payload.sourceType,
      source_id: payload.sourceId,
      source_field: payload.sourceField,
      source_hash: sourceHash,
      source_locale: "ru",
      target_locale: payload.targetLocale,
      translated_text: translatedText,
      provider: "openai",
    }, { onConflict: "source_type,source_id,source_field,source_hash,target_locale" });
    if (insertError) throw insertError;
    return Response.json({ translatedText, cached: false });
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === "Unsupported translation field")) {
      return Response.json({ error: "Некорректный запрос перевода" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
