import type { Handler } from "@netlify/functions";
import { json, methodNotAllowed, parseBody } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { appendAudit } from "./_lib/tickets";

type Body = {
  ticketNumber?: number;
  buyerName?: string;
  paymentMethod?: "zelle" | "cashapp";
  paymentReference?: string | null;
  sessionId?: string;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);

  const body = parseBody<Body>(event.body);
  if (!body.ticketNumber || !body.buyerName || !body.paymentMethod || !body.sessionId) {
    return json(400, { error: "Missing payment fields" });
  }

  try {
    const client = getSupabaseAdmin();

    const { data, error } = await client
      .from("tickets")
      .update({
        status: "pending_payment",
        buyerName: body.buyerName,
        paymentMethod: body.paymentMethod,
        paymentReference: body.paymentReference ?? null,
        updatedAt: new Date().toISOString()
      })
      .eq("number", body.ticketNumber)
      .eq("status", "pending_payment")
      .eq("reservedBySessionId", body.sessionId)
      .select("*")
      .single();

    if (error) return json(409, { error: "Ticket payment submission no longer valid." });

    await appendAudit(client, {
      action: "payment_submit",
      ticketNumber: body.ticketNumber,
      actor: body.buyerName,
      note: body.paymentReference ?? null
    });

    return json(200, { ticket: data });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Payment submit failed"
    });
  }
};
