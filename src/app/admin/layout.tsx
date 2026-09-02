import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin");

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["moderator", "superadmin"]);

  if (!roles?.length) redirect("/");
  return children;
}
