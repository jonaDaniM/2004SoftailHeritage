import type { Handler } from "@netlify/functions";
import { getCookieToken, verifySessionToken } from "./_lib/adminSession";
import { json, methodNotAllowed, parseBody } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { appendAudit } from "./_lib/tickets";

type ManualOperation = "mark_sold" | "restore_available";
type Body = { ticketNumber?: number; operation?: ManualOperation; note?: string | null };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);

  if (!verifySessionToken(getCookieToken(event))) {
    return json(401, { error: "Admin authentication required" });
  }

  const body = parseBody<Body>(event.body);
  if (!body.ticketNumber || !body.operation) {
    return json(400, { error: "ticketNumber and operation are required" });
  }

  if (!Number.isInteger(body.ticketNumber) || body.ticketNumber < 1 || body.ticketNumber > 200) {
    return json(400, { error: "ticketNumber must be between 1 and 200" });
  }

  try {
    const client = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.operation === "mark_sold") {
      const { data, error } = await client
        .from("tickets")
        .update({
          status: "sold",
          buyerName: "Manual Entry",
          reservedBySessionId: null,
          paymentReference: body.note ?? null,
          updatedAt: now
        })
        .eq("number", body.ticketNumber)
        .neq("status", "sold")
        .select("*")
        .single();

      if (error) {
        return json(409, { error: "Ticket could not be manually marked sold." });
      }

      await appendAudit(client, {
        action: "manual_mark_sold",
        ticketNumber: body.ticketNumber,
        actor: "admin",
        note: body.note ?? null
      });

      return json(200, { ticket: data });
    }

    const { data, error } = await client
      .from("tickets")
      .update({
        status: "available",
        buyerName: null,
        paymentMethod: null,
        paymentReference: null,
        reservedBySessionId: null,
        updatedAt: now
      })
      .eq("number", body.ticketNumber)
      .select("*")
      .single();

    if (error) {
      return json(409, { error: "Ticket could not be restored to available." });
    }

    await appendAudit(client, {
      action: "manual_restore_available",
      ticketNumber: body.ticketNumber,
      actor: "admin",
      note: body.note ?? null
    });

    return json(200, { ticket: data });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Manual ticket update failed"
    });
  }
};
