import type { Handler } from "@netlify/functions";
import { json, methodNotAllowed, parseBody } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";

type Body = { ticketNumber?: number; sessionId?: string };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);

  const body = parseBody<Body>(event.body);
  if (!body.ticketNumber || !body.sessionId) {
    return json(400, { error: "ticketNumber and sessionId are required" });
  }

  try {
    const client = getSupabaseAdmin();

    const { data, error } = await client
      .from("tickets")
      .update({
        status: "pending_payment",
        reservedBySessionId: body.sessionId,
        updatedAt: new Date().toISOString()
      })
      .eq("number", body.ticketNumber)
      .eq("tier", "paid")
      .eq("status", "available")
      .select("*")
      .single();

    if (error) return json(409, { error: "Ticket cannot be reserved." });

    return json(200, { ticket: data });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Reserve failed" });
  }
};
