import type { Ticket } from "./ticket";

export const canDraw = (lockedPaidTicket: Ticket | null): boolean => !lockedPaidTicket;

export const canContinueDrawAfterResult = (ticket: Ticket | null): boolean =>
  Boolean(ticket && ticket.tier === "free" && ticket.status === "claimed_free");

export const canSubmitPayment = (ticket: Ticket | null): boolean =>
  Boolean(ticket && ticket.tier === "paid" && ticket.status === "pending_payment");

export const canCancelReservation = (ticket: Ticket | null): boolean =>
  Boolean(ticket && ticket.tier === "paid" && ticket.status === "pending_payment");
