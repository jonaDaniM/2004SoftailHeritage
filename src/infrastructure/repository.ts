import type { AdminAuditEntry, DrawResult, PaymentMethod, Ticket } from "../domain/ticket";

export type PaymentSubmissionInput = {
  ticketNumber: number;
  buyerName: string;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  sessionId: string;
};

export type TicketRepository = {
  listTickets: () => Promise<Ticket[]>;
  drawTicket: (sessionId: string) => Promise<DrawResult>;
  reservePaidTicket: (ticketNumber: number, sessionId: string) => Promise<Ticket>;
  submitPayment: (input: PaymentSubmissionInput) => Promise<Ticket>;
  approveTicket: (ticketNumber: number) => Promise<Ticket>;
  rejectTicket: (ticketNumber: number) => Promise<Ticket>;
  cancelReservation: (ticketNumber: number, sessionId: string) => Promise<Ticket>;
  listAuditLog: () => Promise<AdminAuditEntry[]>;
  subscribe: (onChange: () => void) => () => void;
};
