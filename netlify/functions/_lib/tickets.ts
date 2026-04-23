import type { SupabaseClient } from "@supabase/supabase-js";

export type TicketRow = {
  number: number;
  tier: "paid" | "free";
  status: "available" | "pending_payment" | "approved" | "sold" | "claimed_free" | "canceled";
  buyerName: string | null;
  paymentMethod: "zelle" | "cashapp" | null;
  paymentReference: string | null;
  reservedBySessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditAction =
  | "approve"
  | "reject"
  | "cancel"
  | "draw_free"
  | "draw_paid"
  | "payment_submit"
  | "manual_mark_sold"
  | "manual_restore_available";

const now = () => new Date().toISOString();

const buildInitialRows = (): TicketRow[] =>
  Array.from({ length: 200 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      tier: number <= 150 ? "paid" : "free",
      status: "available",
      buyerName: null,
      paymentMethod: null,
      paymentReference: null,
      reservedBySessionId: null,
      createdAt: now(),
      updatedAt: now()
    };
  });

export const ensureSeededTickets = async (client: SupabaseClient) => {
  const { count, error } = await client.from("tickets").select("number", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const { error: insertError } = await client.from("tickets").insert(buildInitialRows());
  if (insertError) throw insertError;
};

export const appendAudit = async (
  client: SupabaseClient,
  input: { action: AuditAction; ticketNumber: number; actor: string; note?: string | null }
) => {
  const { error } = await client.from("admin_audit").insert({
    action: input.action,
    ticketNumber: input.ticketNumber,
    actor: input.actor,
    note: input.note ?? null,
    createdAt: now()
  });
  if (error) throw error;
};

export const listTickets = async (client: SupabaseClient) => {
  const { data, error } = await client.from("tickets").select("*").order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TicketRow[];
};

export const pickRandomAvailableTicket = async (client: SupabaseClient): Promise<TicketRow | null> => {
  const tickets = await listTickets(client);
  const available = tickets.filter((ticket) => ticket.status === "available");
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
};

export const hasPaidAvailable = async (client: SupabaseClient): Promise<boolean> => {
  const { count, error } = await client
    .from("tickets")
    .select("number", { count: "exact", head: true })
    .eq("tier", "paid")
    .eq("status", "available");

  if (error) throw error;
  return (count ?? 0) > 0;
};
