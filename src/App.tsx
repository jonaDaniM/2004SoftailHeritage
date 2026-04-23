import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { BackButton } from "./components/BackButton";
import { TicketBoard } from "./components/TicketBoard";
import { RulesCard } from "./components/RulesCard";
import { AdminPanel } from "./components/AdminPanel";
import { useRaffle } from "./app/RaffleContext";
import { getPublicAvailableTickets } from "./domain/selectors";
import { canContinueDrawAfterResult, canSubmitPayment } from "./domain/stateMachine";
import type { PaymentMethod } from "./domain/ticket";

const paymentMethods: PaymentMethod[] = ["zelle", "cashapp"];
const base = import.meta.env.BASE_URL;
const galleryImages = [
  { src: `${base}gallery/shared-image-1.png`, alt: "2004 Heritage Softail side profile view" },
  { src: `${base}gallery/shared-image-2.png`, alt: "2004 Heritage Softail front-left angle" },
  { src: `${base}gallery/shared-image-3.png`, alt: "2004 Heritage Softail front-quarter view" },
  { src: `${base}gallery/shared-image-4.png`, alt: "2004 Heritage Softail parking-lot angle" },
  { src: `${base}gallery/shared-image-5.png`, alt: "2004 Heritage Softail close front-quarter view" },
  { src: `${base}gallery/shared-image-6.png`, alt: "2004 Heritage Softail clean side profile" }
];

const HomeScreen = () => {
  const { state, stats } = useRaffle();

  const available = useMemo(() => getPublicAvailableTickets(state.tickets), [state.tickets]);

  return (
    <>
      <section className="hero card">
        <h1>2004 Harley-Davidson Heritage Softail Giveaway</h1>
        <p>Draw your ticket, pay the amount shown, and wait for admin approval.</p>
        <div className="stats-row">
          <div>
            <strong>{stats.paidAvailable}</strong>
            <span>Paid Available</span>
          </div>
          <div>
            <strong>{stats.pending}</strong>
            <span>Pending Approval</span>
          </div>
          <div>
            <strong>{stats.sold}</strong>
            <span>Sold</span>
          </div>
        </div>
        <div className="cta-row">
          <Link className="primary-btn" to="/draw">
            Draw Ticket
          </Link>
          <Link className="ghost-btn" to="/rules">
            View Rules
          </Link>
        </div>
      </section>
      <section className="card">
        <h2>Bike Gallery</h2>
        <p className="muted">Tap any image to view full size.</p>
        <div className="gallery-grid">
          {galleryImages.map((image) => (
            <a key={image.src} href={image.src} target="_blank" rel="noreferrer" className="gallery-item">
              <img src={image.src} alt={image.alt} loading="lazy" />
            </a>
          ))}
        </div>
      </section>
      <TicketBoard tickets={available} />
    </>
  );
};

const DrawScreen = () => {
  const { drawTicket, state } = useRaffle();
  const navigate = useNavigate();

  const lastDraw = state.drawHistory.at(-1) ?? null;

  const onDraw = async () => {
    const ticket = await drawTicket();
    if (!ticket) return;

    if (ticket.tier === "paid") {
      navigate("/payment");
    }
  };

  return (
    <section className="card">
      <div className="row-between">
        <h2>Draw Ticket</h2>
        <BackButton fallback="/" />
      </div>
      <p className="muted">
        Free ticket drawn? Keep drawing. Paid ticket drawn? It locks and you proceed to payment.
      </p>

      {lastDraw ? (
        <div className={`draw-result ${lastDraw.tier}`}>
          <p>Last Draw</p>
          <h3>#{lastDraw.number}</h3>
          <p>{lastDraw.tier === "free" ? "Free ticket, draw again" : `Paid ticket locked: $${lastDraw.number}`}</p>
        </div>
      ) : null}

      <div className="cta-row">
        {canContinueDrawAfterResult(lastDraw) || !lastDraw ? (
          <button type="button" className="primary-btn" onClick={() => void onDraw()}>
            Draw Now
          </button>
        ) : null}

        {state.lockedTicket ? (
          <button type="button" className="ghost-btn" onClick={() => navigate("/payment")}>
            Continue to Payment
          </button>
        ) : null}
      </div>
    </section>
  );
};

const PaymentScreen = () => {
  const { state, submitPayment, cancelCurrentTicket } = useRaffle();
  const navigate = useNavigate();

  const [buyerName, setBuyerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("zelle");
  const [paymentReference, setPaymentReference] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const locked = state.lockedTicket;

  if (!locked || !canSubmitPayment(locked)) {
    return <Navigate to="/draw" replace />;
  }

  const lockedTicket = locked;

  const zelleHandle = import.meta.env.VITE_ZELLE_HANDLE || "Set VITE_ZELLE_HANDLE";
  const cashappHandle = import.meta.env.VITE_CASHAPP_HANDLE || "Set VITE_CASHAPP_HANDLE";

  const copyHandle = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied payment handle.");
    } catch {
      setNotice("Copy failed. Long-press/copy manually.");
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!buyerName.trim()) {
      setNotice("Enter your full name.");
      return;
    }

    try {
      await submitPayment({ buyerName: buyerName.trim(), paymentMethod, paymentReference });
      navigate("/awaiting");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payment submission failed");
    }
  };

  const onCancel = async () => {
    try {
      await cancelCurrentTicket();
      navigate("/result");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cancel failed");
    }
  };

  return (
    <section className="card">
      <div className="row-between">
        <h2>Submit Payment</h2>
        <BackButton fallback="/draw" />
      </div>
      <p className="status ok">
        Locked paid ticket: #{lockedTicket.number} (${lockedTicket.number})
      </p>

      <div className="payment-box">
        <button
          type="button"
          className="payment-select"
          onClick={() => {
            setPaymentMethod("zelle");
            void copyHandle(zelleHandle);
          }}
        >
          Zelle: <strong>{zelleHandle}</strong>
        </button>
        <button type="button" className="ghost-btn" onClick={() => void copyHandle(zelleHandle)}>
          Copy Zelle
        </button>
      </div>

      <div className="payment-box">
        <button
          type="button"
          className="payment-select"
          onClick={() => {
            setPaymentMethod("cashapp");
            void copyHandle(cashappHandle);
          }}
        >
          Cash App: <strong>{cashappHandle}</strong>
        </button>
        <button type="button" className="ghost-btn" onClick={() => void copyHandle(cashappHandle)}>
          Copy Cash App
        </button>
      </div>

      <form className="stack" onSubmit={onSubmit}>
        <label>
          Full Name
          <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required />
        </label>
        <label>
          Payment Method
          <select
            value={paymentMethod}
            onChange={(e) => {
              const nextMethod = e.target.value as PaymentMethod;
              setPaymentMethod(nextMethod);
              const selectedHandle = nextMethod === "zelle" ? zelleHandle : cashappHandle;
              void copyHandle(selectedHandle);
            }}
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment Reference (Optional)
          <input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="last 4 digits, note, timestamp"
          />
        </label>
        <div className="cta-row">
          <button type="submit" className="primary-btn">
            Submit Payment
          </button>
          <button type="button" className="danger-btn" onClick={() => void onCancel()}>
            Cancel Transaction
          </button>
        </div>
      </form>
      {notice ? <p className="status">{notice}</p> : null}
    </section>
  );
};

const AwaitingScreen = () => {
  const { state } = useRaffle();

  if (state.transactionStatus !== "awaiting_approval") {
    if (
      state.transactionStatus === "approved" ||
      state.transactionStatus === "rejected" ||
      state.transactionStatus === "canceled"
    ) {
      return <Navigate to="/result" replace />;
    }

    return <Navigate to="/payment" replace />;
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>Awaiting Approval</h2>
        <BackButton fallback="/" />
      </div>
      <p className="status">Payment submitted. Admin approval pending.</p>
      <p className="muted">This screen updates automatically when ticket status changes.</p>
      <Link className="ghost-btn" to="/result">
        Check Result Status
      </Link>
    </section>
  );
};

const ResultScreen = () => {
  const { state, resetForNextPurchase } = useRaffle();
  const navigate = useNavigate();

  const status = state.transactionStatus;
  const locked = state.lockedTicket;

  return (
    <section className="card">
      <div className="row-between">
        <h2>Ticket Result</h2>
        <BackButton fallback="/" />
      </div>
      {locked ? <p>Ticket #{locked.number}</p> : null}
      <p className="status">
        {status === "approved" && "Approved. Your ticket is sold."}
        {status === "rejected" && "Rejected. Ticket returned to available pool."}
        {status === "canceled" && "Canceled. Reservation released."}
        {status === "awaiting_approval" && "Still pending admin approval."}
        {status === "locked" && "Payment not submitted yet."}
        {status === "idle" && "No active transaction."}
      </p>
      <div className="cta-row">
        {(status === "approved" || status === "rejected" || status === "canceled" || status === "idle") && (
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              resetForNextPurchase();
              navigate("/draw");
            }}
          >
            Buy Another Ticket
          </button>
        )}
        {status === "awaiting_approval" && (
          <Link className="ghost-btn" to="/awaiting">
            Back to Awaiting
          </Link>
        )}
      </div>
    </section>
  );
};

const RulesScreen = () => {
  return (
    <>
      <section className="card">
        <div className="row-between">
          <h2>Help & Rules</h2>
          <BackButton fallback="/" />
        </div>
      </section>
      <RulesCard />
    </>
  );
};

const AdminScreen = () => {
  const { state, adminLogin } = useRaffle();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (state.isAdminAuthenticated) {
    return <AdminPanel />;
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>Admin Login</h2>
        <BackButton fallback="/" />
      </div>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void adminLogin(password).catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Login failed");
          });
        }}
      >
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary-btn" type="submit">
          Login
        </button>
      </form>
      {error ? <p className="status danger">{error}</p> : null}
    </section>
  );
};

const FooterAdminTrigger = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [taps, setTaps] = useState(0);

  const triggerAdmin = () => {
    const next = taps + 1;
    setTaps(next);

    if (next >= 5) {
      setTaps(0);
      navigate("/admin");
      return;
    }

    window.setTimeout(() => {
      setTaps(0);
    }, 1200);
  };

  return (
    <footer className="footer">
      <p>
        Route: <strong>{location.pathname}</strong>
      </p>
      <button type="button" className="footer-secret" onClick={triggerAdmin} aria-label="Hidden admin access">
        Support
      </button>
    </footer>
  );
};

export default function App() {
  const { state, stats } = useRaffle();

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Heritage Softail Raffle</h1>
        <p>{state.repositoryMode === "local" ? "Demo mode (localStorage)" : "Supabase live mode"}</p>
      </header>

      {state.error ? <p className="global-error">{state.error}</p> : null}

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/draw" element={<DrawScreen />} />
          <Route path="/payment" element={<PaymentScreen />} />
          <Route path="/awaiting" element={<AwaitingScreen />} />
          <Route path="/result" element={<ResultScreen />} />
          <Route path="/rules" element={<RulesScreen />} />
          <Route path="/admin" element={<AdminScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <section className="stats-strip">
        <span>Paid Available: {stats.paidAvailable}</span>
        <span>Pending: {stats.pending}</span>
        <span>Sold: {stats.sold}</span>
      </section>

      <FooterAdminTrigger />
    </div>
  );
}
