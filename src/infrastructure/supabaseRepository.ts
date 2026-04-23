import type { AdminAuditEntry, DrawResult, Ticket } from "../domain/ticket";
import { jsonFetch } from "../utils/api";
import { hasSupabaseConfig, supabase } from "./supabaseClient";
import type { PaymentSubmissionInput, TicketRepository } from "./repository";

type TicketsResponse = { tickets: Ticket[] };
type DrawResponse = { draw: DrawResult };
type TicketResponse = { ticket: Ticket };
type AuditResponse = { entries: AdminAuditEntry[] };

const ensureSupabase = () => {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error("Supabase mode is enabled but environment variables are missing.");
  }
};

export const createSupabaseRepository = (): TicketRepository => ({
  async listTickets() {
    ensureSupabase();
    const response = await jsonFetch<TicketsResponse>("/api/tickets");
    return response.tickets.sort((a, b) => a.number - b.number);
  },

  async drawTicket(sessionId) {
    const response = await jsonFetch<DrawResponse>("/api/draw", {
      method: "POST",
      body: JSON.stringify({ sessionId })
    });
    return response.draw;
  },

  async reservePaidTicket(ticketNumber, sessionId) {
    const response = await jsonFetch<TicketResponse>("/api/reserve-paid", {
      method: "POST",
      body: JSON.stringify({ ticketNumber, sessionId })
    });
    return response.ticket;
  },

  async submitPayment(input: PaymentSubmissionInput) {
    const response = await jsonFetch<TicketResponse>("/api/payment-submit", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.ticket;
  },

  async approveTicket(ticketNumber) {
    const response = await jsonFetch<TicketResponse>("/api/admin-approve", {
      method: "POST",
      body: JSON.stringify({ ticketNumber })
    });
    return response.ticket;
  },

  async rejectTicket(ticketNumber) {
    const response = await jsonFetch<TicketResponse>("/api/admin-reject", {
      method: "POST",
      body: JSON.stringify({ ticketNumber })
    });
    return response.ticket;
  },

  async manualMarkSold(ticketNumber, note = null) {
    const response = await jsonFetch<TicketResponse>("/api/admin-manual-ticket", {
      method: "POST",
      body: JSON.stringify({ ticketNumber, operation: "mark_sold", note })
    });
    return response.ticket;
  },

  async manualRestoreAvailable(ticketNumber, note = null) {
    const response = await jsonFetch<TicketResponse>("/api/admin-manual-ticket", {
      method: "POST",
      body: JSON.stringify({ ticketNumber, operation: "restore_available", note })
    });
    return response.ticket;
  },

  async cancelReservation(ticketNumber, sessionId) {
    const response = await jsonFetch<TicketResponse>("/api/cancel-reservation", {
      method: "POST",
      body: JSON.stringify({ ticketNumber, sessionId })
    });
    return response.ticket;
  },

  async listAuditLog() {
    const response = await jsonFetch<AuditResponse>("/api/admin-audit");
    return response.entries;
  },

  subscribe(onChange) {
    ensureSupabase();
    const client = supabase;
    if (!client) {
      throw new Error("Supabase client is unavailable.");
    }

    const channel = client
      .channel("raffle-ticket-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        onChange();
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }
});
