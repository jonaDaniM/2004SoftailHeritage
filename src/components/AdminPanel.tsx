import { useMemo, useState } from "react";
import { useRaffle } from "../app/RaffleContext";

export const AdminPanel = () => {
  const { state, adminApprove, adminReject, adminLogout, setAdminFilter } = useRaffle();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (state.adminFilter === "pending") {
      return state.tickets.filter((ticket) => ticket.status === "pending_payment");
    }
    if (state.adminFilter === "sold") {
      return state.tickets.filter((ticket) => ticket.status === "sold" || ticket.status === "approved");
    }
    return state.tickets.filter((ticket) => ticket.status === "available");
  }, [state.adminFilter, state.tickets]);

  const runAction = async (type: "approve" | "reject", ticketNumber: number) => {
    const confirmed = window.confirm(
      type === "approve"
        ? `Approve and mark #${ticketNumber} as sold?`
        : `Reject and return #${ticketNumber} to available?`
    );

    if (!confirmed) return;

    try {
      if (type === "approve") {
        await adminApprove(ticketNumber);
        setActionMessage(`Ticket #${ticketNumber} approved and sold.`);
      } else {
        await adminReject(ticketNumber);
        setActionMessage(`Ticket #${ticketNumber} rejected and returned to available.`);
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Admin action failed");
    }
  };

  return (
    <section className="card">
      <div className="row-between">
        <h2>Admin Dashboard</h2>
        <button type="button" className="ghost-btn" onClick={() => void adminLogout()}>
          Logout
        </button>
      </div>
      <div className="filter-row">
        <button
          type="button"
          className={state.adminFilter === "pending" ? "filter active" : "filter"}
          onClick={() => setAdminFilter("pending")}
        >
          Pending
        </button>
        <button
          type="button"
          className={state.adminFilter === "sold" ? "filter active" : "filter"}
          onClick={() => setAdminFilter("sold")}
        >
          Sold
        </button>
        <button
          type="button"
          className={state.adminFilter === "available" ? "filter active" : "filter"}
          onClick={() => setAdminFilter("available")}
        >
          Available
        </button>
      </div>

      {actionMessage ? <p className="status ok">{actionMessage}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Status</th>
              <th>Buyer</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ticket) => (
              <tr key={ticket.number}>
                <td>#{ticket.number}</td>
                <td>{ticket.status}</td>
                <td>{ticket.buyerName ?? "-"}</td>
                <td>{ticket.paymentMethod ?? "-"}</td>
                <td>{ticket.paymentReference ?? "-"}</td>
                <td>
                  {ticket.status === "pending_payment" ? (
                    <div className="action-buttons">
                      <button type="button" className="primary-btn" onClick={() => void runAction("approve", ticket.number)}>
                        Approve
                      </button>
                      <button type="button" className="danger-btn" onClick={() => void runAction("reject", ticket.number)}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Audit Log</h3>
      <div className="audit-list">
        {state.auditLog.slice(0, 15).map((entry) => (
          <p key={entry.id}>
            {new Date(entry.createdAt).toLocaleString()} - {entry.action} #{entry.ticketNumber} ({entry.actor})
          </p>
        ))}
      </div>
    </section>
  );
};
