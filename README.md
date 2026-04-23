# 2004 Harley-Davidson Heritage Softail Raffle App

Netlify-ready raffle SPA with secure admin actions via Netlify Functions, Supabase shared state (with realtime), and localStorage demo fallback.

## Stack
- React + Vite + TypeScript
- Netlify Functions for privileged write/auth endpoints
- Supabase for shared persistence + realtime subscriptions
- localStorage adapter for demo/offline mode

## Local Setup
1. Install dependencies:
```bash
npm install
```
2. Create env file from example:
```bash
cp .env.example .env.local
```
3. Set local values in `.env.local`:
- `ADMIN_PASSWORD=<your local admin password>`
- `ADMIN_SESSION_SECRET=<strong-random-secret>`
- `VITE_PERSISTENCE_MODE=local` for demo mode, or `supabase` for shared mode
- Add `VITE_ZELLE_HANDLE` and `VITE_CASHAPP_HANDLE`
- If using Supabase, also set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
4. Start dev server:
```bash
npm run dev
```

## Supabase Setup
1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in Supabase SQL editor.
3. Copy env values listed above.
4. Keep writes locked behind Netlify Functions (service role key only server-side).

## GitHub -> Netlify Deployment
1. Push repo to GitHub.
2. Import repo into Netlify.
3. Netlify build settings:
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
4. Set environment variables in Netlify site settings:
- Server-only:
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Client (`VITE_*`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_PERSISTENCE_MODE`
  - `VITE_ZELLE_HANDLE`
  - `VITE_CASHAPP_HANDLE`

`netlify.toml` already includes SPA redirect (`/* /index.html 200`) and `/api/*` function routing.

## GitHub Pages Deployment
- GitHub Pages is configured via `.github/workflows/deploy-pages.yml`.
- Every push to `main` builds and deploys `dist` to Pages.
- Pages build uses `VITE_PERSISTENCE_MODE=local` (demo mode), because Netlify Functions are not available on GitHub Pages.
- For full admin/password-protected function flow, use Netlify deployment.

## Admin Auth and Hidden Access
- No visible admin button in header/banner.
- Hidden entry is a **5-tap sequence** on the footer `Support` trigger.
- Admin login validates password server-side in `admin-login` Netlify Function using `process.env.ADMIN_PASSWORD`.
- Admin session is cookie-based (`HttpOnly`, `SameSite=Lax`, `Secure`) and checked by admin functions.
- Logout clears session cookie.
- In `VITE_PERSISTENCE_MODE=local`, admin auth uses sessionStorage-only demo auth (no server secret validation).

## Ticket Lifecycle and State Rules
- Canonical ticket model:
  - `number`, `tier`, `status`, `buyerName`, `paymentMethod`, `paymentReference`, `reservedBySessionId`, `createdAt`, `updatedAt`
- Status values:
  - `available`, `pending_payment`, `approved`, `sold`, `claimed_free`, `canceled`
- Raffle behavior:
  - Only `available` tickets can be drawn.
  - Free draw (`151-200`) becomes `claimed_free`; user continues drawing.
  - First paid draw (`1-150`) locks ticket as `pending_payment` for that session.
  - Paid ticket cannot be redrawn unless current transaction is canceled.
  - Payment submit keeps ticket pending until admin action.
  - Admin approve -> `sold` (immediately removed from public board/draw pool).
  - Admin reject -> returns to `available`.

## Persistence Modes
- `VITE_PERSISTENCE_MODE=supabase` (default intended production):
  - Shared cross-device state with realtime updates.
- `VITE_PERSISTENCE_MODE=local`:
  - localStorage demo mode with same UI/business rules.

## Manual Test Checklist
- [ ] Draw free then paid ticket
- [ ] Draw paid ticket directly
- [ ] Cannot redraw after paid ticket is locked
- [ ] Buy Another Ticket appears only after resolved/canceled transaction
- [ ] Payment submission sets awaiting approval state
- [ ] Admin approve marks ticket sold
- [ ] Admin reject returns ticket to available
- [ ] Sold ticket disappears immediately from public board/draw pool
- [ ] Public and admin counters match
- [ ] Back buttons always return to valid previous state
- [ ] Refresh/deep-link works on Netlify
- [ ] Sold-out flow handles zero paid tickets available

## Security Notes
- `ADMIN_PASSWORD` is never hardcoded in tracked source files.
- Real env files are ignored in `.gitignore`.
- `.env.example` contains only placeholders.
- For real password validation locally, run through Netlify Functions (`netlify dev`) instead of Vite-only dev server.
