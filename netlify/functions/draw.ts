import type { Handler } from "@netlify/functions";
import { json, methodNotAllowed, parseBody } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import {
  appendAudit,
  ensureSeededTickets,
  hasPaidAvailable,
  pickRandomAvailableTicket,
  type TicketRow
} from "./_lib/tickets";

type DrawBody = { sessionId?: string };

const now = () => new Date().toISOString();

const tryClaimTicket = async (
  ticket: TicketRow,
  sessionId: string,
  status: "claimed_free" | "pending_payment"
) => {
  const client = getSupabaseAdmin();

  const { data, error } = await client
    .from("tickets")
    .update({
      status,
      reservedBySessionId: sessionId,
      updatedAt: now()
    })
    .eq("number", ticket.number)
    .eq("status", "available")
    .select("*")
    .single();

  if (error) {
    return null;
  }

  return data as TicketRow;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return methodNotAllowed(event.httpMethod);

  const body = parseBody<DrawBody>(event.body);
  if (!body.sessionId) {
    return json(400, { error: "sessionId is required" });
  }

  try {
    const client = getSupabaseAdmin();
    await ensureSeededTickets(client);

    const paidAvailable = await hasPaidAvailable(client);
    if (!paidAvailable) {
      return json(200, {
        draw: {
          soldOut: true,
          ticket: {
            number: 0,
            tier: "paid",
            status: "sold",
            buyerName: null,
            paymentMethod: null,
            paymentReference: null,
            reservedBySessionId: null,
            createdAt: now(),
            updatedAt: now()
          }
        }
      });
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const picked = await pickRandomAvailableTicket(client);
      if (!picked) break;

      const status = picked.tier === "free" ? "claimed_free" : "pending_payment";
      const claimed = await tryClaimTicket(picked, body.sessionId, status);
      if (!claimed) continue;

      await appendAudit(client, {
        action: claimed.tier === "free" ? "draw_free" : "draw_paid",
        ticketNumber: claimed.number,
        actor: "public"
      });

      return json(200, {
        draw: {
          soldOut: false,
          ticket: claimed
        }
      });
    }

    return json(409, { error: "Please draw again. Ticket state changed." });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Draw request failed"
    });
  }
};
