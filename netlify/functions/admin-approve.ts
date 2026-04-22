import type { Handler } from "@netlify/functions";
import { getCookieToken, verifySessionToken } from "./_lib/adminSession";
import { json, methodNotAllowed, parseBody } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { appendAudit } from "./_lib/tickets";

type Body = { ticketNumber?: number };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);

  if (!verifySessionToken(getCookieToken(event))) {
    return json(401, { error: "Admin authentication required" });
  }

  const body = parseBody<Body>(event.body);
  if (!body.ticketNumber) return json(400, { error: "ticketNumber required" });

  try {
    const client = getSupabaseAdmin();

    const { data, error } = await client
      .from("tickets")
      .update({ status: "sold", updatedAt: new Date().toISOString() })
      .eq("number", body.ticketNumber)
      .eq("status", "pending_payment")
      .select("*")
      .single();

    if (error) return json(409, { error: "Ticket cannot be approved in current state." });

    await appendAudit(client, {
      action: "approve",
      ticketNumber: body.ticketNumber,
      actor: "admin"
    });

    return json(200, { ticket: data });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Approve failed" });
  }
};
