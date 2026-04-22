export const RulesCard = () => {
  return (
    <section className="card">
      <h2>Raffle Rules</h2>
      <ul className="rules-list">
        <li>200 total tickets.</li>
        <li>Paid tickets: #1-150.</li>
        <li>Free tickets: #151-200.</li>
        <li>If you draw a free ticket, keep drawing until you draw a paid ticket.</li>
        <li>Your paid ticket number is the dollar amount due.</li>
        <li>Payment methods: Zelle or Cash App only.</li>
      </ul>
    </section>
  );
};
