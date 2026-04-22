import type { Handler } from "@netlify/functions";
import { getSupabaseAdmin } from "./_lib/supabaseAdmin";
import { ensureSeededTickets, listTickets } from "./_lib/tickets";
import { json, methodNotAllowed } from "./_lib/http";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") return methodNotAllowed(event.httpMethod);

  try {
    const client = getSupabaseAdmin();
    await ensureSeededTickets(client);
    const tickets = await listTickets(client);
    return json(200, { tickets });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Failed to load tickets"
    });
  }
};
