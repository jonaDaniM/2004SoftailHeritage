import { useMemo, useState } from "react";
import { useRaffle } from "../app/RaffleContext";

export const AdminPanel = () => {
  const {
    state,
    adminApprove,
    adminReject,
    adminManualMarkSold,
    adminManualRestoreAvailable,
    adminLogout,
    setAdminFilter
  } = useRaffle();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [manualTicketNumber, setManualTicketNumber] = useState("");
  const [manualNote, setManualNote] = useState("");

  const rows = useMemo(() => {
    if (state.adminFilter === "pending") {
      return state.tickets.filter((ticket) => ticket.status === "pending_payment");
    }
    if (state.adminFilter === "sold") {
      return state.tickets.filter((ticket) => ticket.status === "sold" || ticket.status === "approved");
    }
    return state.tickets.filter((ticket) => ticket.status === "available");
  }, [state.adminFilter, state.tickets]);

  const runAction = async (
    type: "approve" | "reject" | "manual_mark_sold" | "manual_restore_available",
    ticketNumber: number
  ) => {
    const messageMap = {
      approve: `Approve and mark #${ticketNumber} as sold?`,
      reject: `Reject and return #${ticketNumber} to available?`,
      manual_mark_sold: `Manually remove #${ticketNumber} from public list (mark sold)?`,
      manual_restore_available: `Restore #${ticketNumber} back to available list?`
    } as const;

    const confirmed = window.confirm(
      messageMap[type]
    );

    if (!confirmed) return;

    try {
      if (type === "approve") {
        await adminApprove(ticketNumber);
        setActionMessage(`Ticket #${ticketNumber} approved and sold.`);
      } else if (type === "reject") {
        await adminReject(ticketNumber);
        setActionMessage(`Ticket #${ticketNumber} rejected and returned to available.`);
      } else if (type === "manual_mark_sold") {
        await adminManualMarkSold(ticketNumber, manualNote);
        setActionMessage(`Ticket #${ticketNumber} manually marked sold and removed from list.`);
      } else {
        await adminManualRestoreAvailable(ticketNumber, manualNote);
        setActionMessage(`Ticket #${ticketNumber} manually restored to available.`);
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Admin action failed");
    }
  };

  const onManualSubmit = async (type: "manual_mark_sold" | "manual_restore_available") => {
    const ticketNumber = Number(manualTicketNumber);
    if (!Number.isInteger(ticketNumber) || ticketNumber < 1 || ticketNumber > 200) {
      setActionMessage("Enter a valid ticket number from 1 to 200.");
      return;
    }

    await runAction(type, ticketNumber);
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

      <div className="manual-admin-controls">
        <h3>Manual Number Control</h3>
        <p className="muted">Use this for real-life payments/draw updates.</p>
        <div className="manual-form">
          <input
            type="number"
            min={1}
            max={200}
            value={manualTicketNumber}
            onChange={(event) => setManualTicketNumber(event.target.value)}
            placeholder="Ticket #"
          />
          <input
            value={manualNote}
            onChange={(event) => setManualNote(event.target.value)}
            placeholder="Optional note"
          />
          <button type="button" className="danger-btn" onClick={() => void onManualSubmit("manual_mark_sold")}>
            Remove Number
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => void onManualSubmit("manual_restore_available")}
          >
            Restore Number
          </button>
        </div>
      </div>

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
                  ) : ticket.status === "available" ? (
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="danger-btn"
                        onClick={() => void runAction("manual_mark_sold", ticket.number)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : ticket.status === "sold" || ticket.status === "approved" ? (
                    <div className="action-buttons">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => void runAction("manual_restore_available", ticket.number)}
                      >
                        Restore
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
