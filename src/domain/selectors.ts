import type { Ticket, TicketStats } from "./ticket";

export const getPublicAvailableTickets = (tickets: Ticket[]): Ticket[] =>
  tickets.filter((ticket) => ticket.status === "available");

export const getStats = (tickets: Ticket[]): TicketStats => {
  const publicAvailable = getPublicAvailableTickets(tickets);
  return {
    total: tickets.length,
    paidAvailable: publicAvailable.filter((ticket) => ticket.tier === "paid").length,
    freeAvailable: publicAvailable.filter((ticket) => ticket.tier === "free").length,
    pending: tickets.filter((ticket) => ticket.status === "pending_payment").length,
    sold: tickets.filter((ticket) => ticket.status === "sold" || ticket.status === "approved").length,
    claimedFree: tickets.filter((ticket) => ticket.status === "claimed_free").length
  };
};
