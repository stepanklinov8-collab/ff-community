import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const contactFields = z.object({
  name: z.string().trim().min(2).max(100),
  role: z.string().trim().max(100),
  description: z.string().trim().max(500),
  socialLink: z.string().url().or(z.literal("")),
  profileId: z.string().uuid().nullable().optional(),
  phone: z.string().trim().max(40).optional(),
});
const updateSchema = contactFields.extend({ id: z.string().uuid() });

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { data, error } = await createAdminClient().from("contacts").select("*").order("sort_order").order("created_at");
    if (error) throw error;
    return Response.json({ contacts: data ?? [] });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const payload = contactFields.parse(await request.json());
    const { error } = await createAdminClient().from("contacts").insert({
      name: payload.name, role: payload.role, description: payload.description,
      social_link: payload.socialLink || null, profile_id: payload.profileId ?? null,
      phone: payload.phone || null,
    });
    if (error) throw error;
    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте контакт и ссылку" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const payload = updateSchema.parse(await request.json());
    const { error } = await createAdminClient().from("contacts").update({
      name: payload.name, role: payload.role, description: payload.description,
      social_link: payload.socialLink || null, profile_id: payload.profileId ?? null,
      phone: payload.phone || null,
    }).eq("id", payload.id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте контакт и ссылку" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const { error } = await createAdminClient().from("contacts").delete().eq("id", id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректный ID" }, { status: 400 });
    return authErrorResponse(error);
  }
}
