import "server-only";
// New modules use this entry point rather than creating unguarded database clients.
export { createAdminClient } from "@/utils/supabase/admin";
export { createServerSupabaseClient } from "@/utils/supabase/server";
export { requireUser, requireAdmin, requireSuperadmin, authErrorResponse } from "@/utils/supabase/server-auth";
