import {
  createInitialTickets,
  type AdminAuditEntry,
  type DrawResult,
  type Ticket,
  type TicketStatus
} from "../domain/ticket";
import type { PaymentSubmissionInput, TicketRepository } from "./repository";

const TICKETS_KEY = "harley-raffle-tickets";
const AUDIT_KEY = "harley-raffle-audit";

const nowIso = () => new Date().toISOString();

const readTickets = (): Ticket[] => {
  const raw = localStorage.getItem(TICKETS_KEY);
  if (!raw) {
    const seeded = createInitialTickets();
    localStorage.setItem(TICKETS_KEY, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(raw) as Ticket[];
};

const writeTickets = (tickets: Ticket[]) => {
  localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  window.dispatchEvent(new Event("raffle-local-change"));
};

const readAudit = (): AdminAuditEntry[] => {
  const raw = localStorage.getItem(AUDIT_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as AdminAuditEntry[];
};

const writeAudit = (entries: AdminAuditEntry[]) => {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
};

const recordAudit = (
  action: AdminAuditEntry["action"],
  ticketNumber: number,
  actor: string,
  note: string | null = null
) => {
  const entries = readAudit();
  entries.unshift({
    id: crypto.randomUUID(),
    action,
    ticketNumber,
    actor,
    createdAt: nowIso(),
    note
  });
  writeAudit(entries.slice(0, 100));
};

const withTicketUpdate = (
  ticketNumber: number,
  updater: (ticket: Ticket) => Ticket,
  expectedStatus?: TicketStatus
): Ticket => {
  const tickets = readTickets();
  const index = tickets.findIndex((ticket) => ticket.number === ticketNumber);
  if (index === -1) throw new Error("Ticket not found");

  const current = tickets[index];
  if (expectedStatus && current.status !== expectedStatus) {
    throw new Error("Ticket is no longer in a valid state");
  }

  const next = updater(current);
  tickets[index] = next;
  writeTickets(tickets);
  return next;
};

const chooseRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const createLocalStorageRepository = (): TicketRepository => ({
  async listTickets() {
    return readTickets().sort((a, b) => a.number - b.number);
  },

  async drawTicket(sessionId) {
    const available = readTickets().filter((ticket) => ticket.status === "available");
    if (!available.length) {
      return {
        soldOut: true,
        ticket: readTickets()[0] ?? createInitialTickets()[0]
      };
    }

    const selected = chooseRandom(available);
    const nextStatus: TicketStatus = selected.tier === "free" ? "claimed_free" : "pending_payment";

    const updated = withTicketUpdate(selected.number, (ticket) => ({
      ...ticket,
      status: nextStatus,
      reservedBySessionId: sessionId,
      updatedAt: nowIso()
    }), "available");

    recordAudit(selected.tier === "free" ? "draw_free" : "draw_paid", selected.number, "public");

    return {
      soldOut: false,
      ticket: updated
    } satisfies DrawResult;
  },

  async reservePaidTicket(ticketNumber, sessionId) {
    return withTicketUpdate(ticketNumber, (ticket) => ({
      ...ticket,
      status: "pending_payment",
      reservedBySessionId: sessionId,
      updatedAt: nowIso()
    }), "available");
  },

  async submitPayment(input) {
    const updated = withTicketUpdate(input.ticketNumber, (ticket) => {
      if (ticket.reservedBySessionId !== input.sessionId) {
        throw new Error("This ticket is reserved by a different session");
      }

      return {
        ...ticket,
        status: "pending_payment",
        buyerName: input.buyerName,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference,
        updatedAt: nowIso()
      };
    }, "pending_payment");

    recordAudit("payment_submit", input.ticketNumber, input.buyerName, input.paymentReference);
    return updated;
  },

  async approveTicket(ticketNumber) {
    const updated = withTicketUpdate(ticketNumber, (ticket) => ({
      ...ticket,
      status: "sold",
      updatedAt: nowIso()
    }), "pending_payment");

    recordAudit("approve", ticketNumber, "admin");
    return updated;
  },

  async rejectTicket(ticketNumber) {
    const updated = withTicketUpdate(ticketNumber, (ticket) => ({
      ...ticket,
      status: "available",
      buyerName: null,
      paymentMethod: null,
      paymentReference: null,
      reservedBySessionId: null,
      updatedAt: nowIso()
    }), "pending_payment");

    recordAudit("reject", ticketNumber, "admin");
    return updated;
  },

  async cancelReservation(ticketNumber, sessionId) {
    const updated = withTicketUpdate(ticketNumber, (ticket) => {
      if (ticket.reservedBySessionId !== sessionId) {
        throw new Error("Ticket is reserved by another session");
      }

      return {
        ...ticket,
        status: "available",
        buyerName: null,
        paymentMethod: null,
        paymentReference: null,
        reservedBySessionId: null,
        updatedAt: nowIso()
      };
    }, "pending_payment");

    recordAudit("cancel", ticketNumber, "public");
    return updated;
  },

  async listAuditLog() {
    return readAudit();
  },

  subscribe(onChange) {
    const handler = () => onChange();
    window.addEventListener("storage", handler);
    window.addEventListener("raffle-local-change", handler);

    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("raffle-local-change", handler);
    };
  }
});
