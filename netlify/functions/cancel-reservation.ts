import type { Handler } from "@netlify/functions";
import { json, methodNotAllowed, parseBody } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { appendAudit } from "./_lib/tickets";

type Body = { ticketNumber?: number; sessionId?: string };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);

  const body = parseBody<Body>(event.body);
  if (!body.ticketNumber || !body.sessionId) {
    return json(400, { error: "ticketNumber and sessionId required" });
  }

  try {
    const client = getSupabaseAdmin();

    const { data, error } = await client
      .from("tickets")
      .update({
        status: "available",
        buyerName: null,
        paymentMethod: null,
        paymentReference: null,
        reservedBySessionId: null,
        updatedAt: new Date().toISOString()
      })
      .eq("number", body.ticketNumber)
      .eq("status", "pending_payment")
      .eq("reservedBySessionId", body.sessionId)
      .select("*")
      .single();

    if (error) return json(409, { error: "Cancel failed due to state mismatch." });

    await appendAudit(client, {
      action: "cancel",
      ticketNumber: body.ticketNumber,
      actor: "public"
    });

    return json(200, { ticket: data });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Cancel failed"
    });
  }
};
