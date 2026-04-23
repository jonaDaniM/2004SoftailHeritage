export type TicketTier = "paid" | "free";

export type TicketStatus =
  | "available"
  | "pending_payment"
  | "approved"
  | "sold"
  | "claimed_free"
  | "canceled";

export type PaymentMethod = "zelle" | "cashapp";

export type Ticket = {
  number: number;
  tier: TicketTier;
  status: TicketStatus;
  buyerName: string | null;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  reservedBySessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DrawResult = {
  ticket: Ticket;
  soldOut: boolean;
};

export type TicketStats = {
  total: number;
  paidAvailable: number;
  freeAvailable: number;
  pending: number;
  sold: number;
  claimedFree: number;
};

export type AdminAuditEntry = {
  id: string;
  action:
    | "approve"
    | "reject"
    | "cancel"
    | "draw_free"
    | "draw_paid"
    | "payment_submit"
    | "manual_mark_sold"
    | "manual_restore_available";
  ticketNumber: number;
  actor: string;
  createdAt: string;
  note: string | null;
};

export const TOTAL_TICKETS = 200;
export const PAID_TICKET_MAX = 150;
export const FREE_TICKET_MIN = 151;

export const getTicketTier = (ticketNumber: number): TicketTier =>
  ticketNumber <= PAID_TICKET_MAX ? "paid" : "free";

export const createInitialTickets = (): Ticket[] => {
  const now = new Date().toISOString();
  return Array.from({ length: TOTAL_TICKETS }, (_, idx) => {
    const number = idx + 1;
    return {
      number,
      tier: getTicketTier(number),
      status: "available",
      buyerName: null,
      paymentMethod: null,
      paymentReference: null,
      reservedBySessionId: null,
      createdAt: now,
      updatedAt: now
    };
  });
};
