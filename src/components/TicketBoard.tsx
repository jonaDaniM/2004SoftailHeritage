import type { Ticket } from "../domain/ticket";

type Props = {
  tickets: Ticket[];
};

export const TicketBoard = ({ tickets }: Props) => {
  return (
    <section className="card">
      <h2>Available Ticket Board</h2>
      <p className="muted">Only available numbers are shown.</p>
      <div className="ticket-grid">
        {tickets.map((ticket) => (
          <div key={ticket.number} className={`ticket-pill ${ticket.tier}`}>
            #{ticket.number}
          </div>
        ))}
      </div>
      {!tickets.length ? <p className="status sold">Paid tickets are sold out.</p> : null}
    </section>
  );
};
