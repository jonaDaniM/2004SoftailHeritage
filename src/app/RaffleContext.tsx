import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from "react";
import { getStats } from "../domain/selectors";
import { canCancelReservation, canDraw, canSubmitPayment } from "../domain/stateMachine";
import type { AdminAuditEntry, PaymentMethod, Ticket } from "../domain/ticket";
import { createRepository } from "../infrastructure/createRepository";
import type { TicketRepository } from "../infrastructure/repository";
import { getOrCreateSessionId } from "../utils/session";
import { jsonFetch } from "../utils/api";

type TransactionStatus = "idle" | "locked" | "awaiting_approval" | "approved" | "rejected" | "canceled";

type RaffleState = {
  tickets: Ticket[];
  drawHistory: Ticket[];
  lockedTicket: Ticket | null;
  transactionStatus: TransactionStatus;
  loading: boolean;
  error: string | null;
  isAdminAuthenticated: boolean;
  adminFilter: "pending" | "sold" | "available";
  auditLog: AdminAuditEntry[];
  repositoryMode: "local" | "supabase";
};

type RaffleContextValue = {
  state: RaffleState;
  stats: ReturnType<typeof getStats>;
  sessionId: string;
  refreshAll: () => Promise<void>;
  drawTicket: () => Promise<Ticket | null>;
  cancelCurrentTicket: () => Promise<void>;
  submitPayment: (input: {
    buyerName: string;
    paymentMethod: PaymentMethod;
    paymentReference: string;
  }) => Promise<void>;
  setAdminFilter: (filter: RaffleState["adminFilter"]) => void;
  adminLogin: (password: string) => Promise<void>;
  adminLogout: () => Promise<void>;
  checkAdminSession: () => Promise<void>;
  adminApprove: (ticketNumber: number) => Promise<void>;
  adminReject: (ticketNumber: number) => Promise<void>;
  adminManualMarkSold: (ticketNumber: number, note?: string) => Promise<void>;
  adminManualRestoreAvailable: (ticketNumber: number, note?: string) => Promise<void>;
  resetForNextPurchase: () => void;
};

const raffleContext = createContext<RaffleContextValue | null>(null);

type Action =
  | { type: "set_loading"; payload: boolean }
  | { type: "set_error"; payload: string | null }
  | { type: "set_tickets"; payload: Ticket[] }
  | { type: "set_locked_ticket"; payload: Ticket | null }
  | { type: "add_draw"; payload: Ticket }
  | { type: "lock_ticket"; payload: Ticket }
  | { type: "set_transaction_status"; payload: TransactionStatus }
  | { type: "reset_transaction" }
  | { type: "set_admin_auth"; payload: boolean }
  | { type: "set_admin_filter"; payload: RaffleState["adminFilter"] }
  | { type: "set_audit_log"; payload: AdminAuditEntry[] };

const initialState: RaffleState = {
  tickets: [],
  drawHistory: [],
  lockedTicket: null,
  transactionStatus: "idle",
  loading: false,
  error: null,
  isAdminAuthenticated: false,
  adminFilter: "pending",
  auditLog: [],
  repositoryMode: "local"
};

const reducer = (state: RaffleState, action: Action): RaffleState => {
  switch (action.type) {
    case "set_loading":
      return { ...state, loading: action.payload };
    case "set_error":
      return { ...state, error: action.payload };
    case "set_tickets":
      return { ...state, tickets: action.payload };
    case "set_locked_ticket":
      return { ...state, lockedTicket: action.payload };
    case "add_draw":
      return { ...state, drawHistory: [...state.drawHistory, action.payload] };
    case "lock_ticket":
      return {
        ...state,
        lockedTicket: action.payload,
        transactionStatus: "locked"
      };
    case "set_transaction_status":
      return { ...state, transactionStatus: action.payload };
    case "reset_transaction":
      return {
        ...state,
        drawHistory: [],
        lockedTicket: null,
        transactionStatus: "idle"
      };
    case "set_admin_auth":
      return { ...state, isAdminAuthenticated: action.payload };
    case "set_admin_filter":
      return { ...state, adminFilter: action.payload };
    case "set_audit_log":
      return { ...state, auditLog: action.payload };
    default:
      return state;
  }
};

type Props = {
  children: ReactNode;
};

const { repository, mode } = createRepository();
const DEMO_ADMIN_SESSION_KEY = "harley-raffle-demo-admin-auth";

const fetchTicketsAndAudit = async (
  repo: TicketRepository,
  isAdminAuthenticated: boolean
): Promise<{ tickets: Ticket[]; audit: AdminAuditEntry[] }> => {
  const tickets = await repo.listTickets();
  const audit = isAdminAuthenticated ? await repo.listAuditLog().catch(() => []) : [];
  return { tickets, audit };
};

export const RaffleProvider = ({ children }: Props) => {
  const [state, dispatch] = useReducer(reducer, { ...initialState, repositoryMode: mode });
  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  const refreshAll = useCallback(async () => {
    dispatch({ type: "set_loading", payload: true });
    dispatch({ type: "set_error", payload: null });

    try {
      const { tickets, audit } = await fetchTicketsAndAudit(repository, state.isAdminAuthenticated);
      dispatch({ type: "set_tickets", payload: tickets });
      if (state.isAdminAuthenticated) {
        dispatch({ type: "set_audit_log", payload: audit });
      }
    } catch (error) {
      dispatch({
        type: "set_error",
        payload: error instanceof Error ? error.message : "Failed to refresh raffle data"
      });
    } finally {
      dispatch({ type: "set_loading", payload: false });
    }
  }, [state.isAdminAuthenticated]);

  const drawTicket = useCallback(async (): Promise<Ticket | null> => {
    if (!canDraw(state.lockedTicket)) {
      dispatch({ type: "set_error", payload: "Your paid ticket is locked. Cancel it to draw again." });
      return null;
    }

    dispatch({ type: "set_error", payload: null });

    try {
      const result = await repository.drawTicket(sessionId);
      if (result.soldOut) {
        dispatch({ type: "set_error", payload: "Paid tickets are sold out." });
        return null;
      }

      dispatch({ type: "add_draw", payload: result.ticket });
      if (result.ticket.tier === "paid") {
        dispatch({ type: "lock_ticket", payload: result.ticket });
      }

      await refreshAll();
      return result.ticket;
    } catch (error) {
      dispatch({
        type: "set_error",
        payload: error instanceof Error ? error.message : "Unable to draw ticket"
      });
      return null;
    }
  }, [refreshAll, sessionId, state.lockedTicket]);

  const cancelCurrentTicket = useCallback(async () => {
    const lockedTicket = state.lockedTicket;
    if (!lockedTicket || !canCancelReservation(lockedTicket)) {
      dispatch({ type: "set_error", payload: "No active paid ticket reservation to cancel." });
      return;
    }

    await repository.cancelReservation(lockedTicket.number, sessionId);
    dispatch({ type: "set_transaction_status", payload: "canceled" });
    await refreshAll();
  }, [refreshAll, sessionId, state.lockedTicket]);

  const submitPayment = useCallback(
    async (input: { buyerName: string; paymentMethod: PaymentMethod; paymentReference: string }) => {
      const lockedTicket = state.lockedTicket;
      if (!lockedTicket || !canSubmitPayment(lockedTicket)) {
        dispatch({
          type: "set_error",
          payload: "A paid ticket must be locked before submitting payment."
        });
        return;
      }

      await repository.submitPayment({
        ticketNumber: lockedTicket.number,
        buyerName: input.buyerName,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference.trim() || null,
        sessionId
      });

      dispatch({ type: "set_transaction_status", payload: "awaiting_approval" });
      await refreshAll();
    },
    [refreshAll, sessionId, state.lockedTicket]
  );

  const adminLogin = useCallback(async (password: string) => {
    if (mode === "local") {
      if (!password.trim()) {
        throw new Error("Password is required.");
      }
      sessionStorage.setItem(DEMO_ADMIN_SESSION_KEY, "true");
      dispatch({ type: "set_admin_auth", payload: true });
      await refreshAll();
      return;
    }

    await jsonFetch<{ ok: boolean }>("/api/admin-login", {
      method: "POST",
      body: JSON.stringify({ password })
    });

    dispatch({ type: "set_admin_auth", payload: true });
    await refreshAll();
  }, [refreshAll]);

  const adminLogout = useCallback(async () => {
    if (mode === "local") {
      sessionStorage.removeItem(DEMO_ADMIN_SESSION_KEY);
      dispatch({ type: "set_admin_auth", payload: false });
      dispatch({ type: "set_audit_log", payload: [] });
      return;
    }

    await jsonFetch<{ ok: boolean }>("/api/admin-logout", { method: "POST", body: JSON.stringify({}) });
    dispatch({ type: "set_admin_auth", payload: false });
    dispatch({ type: "set_audit_log", payload: [] });
  }, []);

  const checkAdminSession = useCallback(async () => {
    if (mode === "local") {
      const authenticated = sessionStorage.getItem(DEMO_ADMIN_SESSION_KEY) === "true";
      dispatch({ type: "set_admin_auth", payload: authenticated });
      return;
    }

    try {
      const response = await jsonFetch<{ authenticated: boolean }>("/api/admin-session");
      dispatch({ type: "set_admin_auth", payload: response.authenticated });
    } catch {
      dispatch({ type: "set_admin_auth", payload: false });
    }
  }, []);

  const adminApprove = useCallback(async (ticketNumber: number) => {
    await repository.approveTicket(ticketNumber);

    if (state.lockedTicket?.number === ticketNumber) {
      dispatch({ type: "set_transaction_status", payload: "approved" });
    }

    await refreshAll();
  }, [refreshAll, state.lockedTicket?.number]);

  const adminReject = useCallback(async (ticketNumber: number) => {
    await repository.rejectTicket(ticketNumber);

    if (state.lockedTicket?.number === ticketNumber) {
      dispatch({ type: "set_transaction_status", payload: "rejected" });
    }

    await refreshAll();
  }, [refreshAll, state.lockedTicket?.number]);

  const adminManualMarkSold = useCallback(async (ticketNumber: number, note = "") => {
    await repository.manualMarkSold(ticketNumber, note.trim() || null);

    if (state.lockedTicket?.number === ticketNumber) {
      dispatch({ type: "set_transaction_status", payload: "approved" });
    }

    await refreshAll();
  }, [refreshAll, state.lockedTicket?.number]);

  const adminManualRestoreAvailable = useCallback(async (ticketNumber: number, note = "") => {
    await repository.manualRestoreAvailable(ticketNumber, note.trim() || null);

    if (state.lockedTicket?.number === ticketNumber) {
      dispatch({ type: "set_transaction_status", payload: "rejected" });
    }

    await refreshAll();
  }, [refreshAll, state.lockedTicket?.number]);

  const setAdminFilter = (filter: RaffleState["adminFilter"]) => {
    dispatch({ type: "set_admin_filter", payload: filter });
  };

  const resetForNextPurchase = () => {
    dispatch({ type: "reset_transaction" });
    dispatch({ type: "set_error", payload: null });
  };

  useEffect(() => {
    void refreshAll();
    void checkAdminSession();

    const unsubscribe = repository.subscribe(() => {
      void refreshAll();
    });

    return () => unsubscribe();
  }, [checkAdminSession, refreshAll]);

  useEffect(() => {
    if (!state.lockedTicket) return;

    const latest = state.tickets.find((ticket) => ticket.number === state.lockedTicket?.number) ?? null;
    if (!latest) return;

    dispatch({ type: "set_locked_ticket", payload: latest });

    if (latest.status === "sold" || latest.status === "approved") {
      dispatch({ type: "set_transaction_status", payload: "approved" });
      return;
    }

    if (latest.status === "available") {
      if (state.transactionStatus === "awaiting_approval" || state.transactionStatus === "locked") {
        dispatch({ type: "set_transaction_status", payload: "rejected" });
      }
      return;
    }

    if (latest.status === "pending_payment" && state.transactionStatus !== "awaiting_approval") {
      dispatch({ type: "set_transaction_status", payload: "locked" });
    }
  }, [state.lockedTicket, state.tickets, state.transactionStatus]);

  const stats = useMemo(() => getStats(state.tickets), [state.tickets]);

  return (
    <raffleContext.Provider
      value={{
        state,
        stats,
        sessionId,
        refreshAll,
        drawTicket,
        cancelCurrentTicket,
        submitPayment,
        setAdminFilter,
        adminLogin,
        adminLogout,
        checkAdminSession,
        adminApprove,
        adminReject,
        adminManualMarkSold,
        adminManualRestoreAvailable,
        resetForNextPurchase
      }}
    >
      {children}
    </raffleContext.Provider>
  );
};

export const useRaffle = () => {
  const context = useContext(raffleContext);
  if (!context) throw new Error("useRaffle must be used inside RaffleProvider");
  return context;
};
