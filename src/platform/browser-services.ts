"use client";
// Shared browser adapters keep modules independent of application internals.
export { createClient } from "@/utils/supabase/client";
export { authFetch } from "@/utils/api/auth-fetch";
