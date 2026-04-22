import type { Handler } from "@netlify/functions";
import { getCookieToken, verifySessionToken } from "./_lib/adminSession";
import { json, methodNotAllowed } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") return methodNotAllowed(event.httpMethod);

  if (!verifySessionToken(getCookieToken(event))) {
    return json(401, { error: "Admin authentication required" });
  }

  try {
    const client = getSupabaseAdmin();

    const { data, error } = await client
      .from("admin_audit")
      .select("*")
      .order("createdAt", { ascending: false })
      .limit(100);

    if (error) throw error;

    return json(200, { entries: data ?? [] });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Failed to load audit log"
    });
  }
};
